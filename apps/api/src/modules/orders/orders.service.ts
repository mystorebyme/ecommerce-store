// Purpose: orders: Business logic
//
// Is slice me sirf ek kaam hai: **order create karna** — server-side price, atomic
// stock, aur idempotency. Cart/coupons/shipping/invoice baad ke modules me.
//
// Critical rules yahan lagte hain:
//   #1 paisa integer paise
//   #2 server price decide karta hai (client ka amount ignore)
//   #3 stock atomic decrement
//   #6 order create idempotent

import type { CreateOrderInput } from "@youpi/validation";
import type { Db, OrderWithItems } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";

export interface CreateOrderDeps {
  db: Db;
  now?: () => Date;
}

export interface CreateOrderResult {
  order: OrderWithItems;
  /** true = same Idempotency-Key dobara aayi, naya order nahi bana. */
  replayed: boolean;
}

export function createOrdersService({ db, now = () => new Date() }: CreateOrderDeps) {
  return {
    async create(input: CreateOrderInput, idempotencyKey: string): Promise<CreateOrderResult> {
      // 1. Same key pehle aa chuki hai? Wahi order wapas do (double click safe).
      const existing = await db.findOrderByIdempotencyKey(idempotencyKey);
      if (existing) return { order: (await db.findOrderById(existing.id))!, replayed: true };

      // 2. Product rows DB se — client ka price/name kabhi trust nahi.
      const products = await db.findProductsByIds(input.items.map((item) => item.productId));
      const byId = new Map(products.map((product) => [product.id, product]));

      const lines = input.items.map((item) => {
        const product = byId.get(item.productId);
        if (!product) {
          throw AppError.notFound("PRODUCT_NOT_FOUND", `Product ${item.productId} exist nahi karta.`);
        }
        if (!product.active) {
          throw AppError.conflict("PRODUCT_INACTIVE", `${product.name} abhi available nahi hai.`);
        }
        return {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          unitPricePaise: product.pricePaise,
          qty: item.qty,
          lineTotalPaise: product.pricePaise * item.qty,
        };
      });

      const amountPaise = lines.reduce((total, line) => total + line.lineTotalPaise, 0);

      // 3. Stock atomically reserve — ek bhi fail hua to sab rollback.
      const reserved: string[] = [];
      for (const line of lines) {
        const ok = await db.decrementStock(line.productId, line.qty);
        if (!ok) {
          await Promise.all(reserved.map((productId, index) => db.incrementStock(productId, lines[index]!.qty)));
          throw AppError.conflict(
            "OUT_OF_STOCK",
            `${line.name} ka stock khatam ho gaya. Qty kam karke try karo.`,
          );
        }
        reserved.push(line.productId);
      }

      // 4. Order record — unique violation ka matlab concurrent duplicate request.
      try {
        const order = await db.createOrder({
          number: buildOrderNumber(now()),
          amountPaise,
          currency: "INR",
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          idempotencyKey,
          items: lines,
        });
        const withItems = await db.findOrderById(order.id);
        return { order: withItems!, replayed: false };
      } catch (error) {
        // Stock wapas, phir duplicate-key case handle karo.
        await Promise.all(lines.map((line) => db.incrementStock(line.productId, line.qty)));
        const replay = await db.findOrderByIdempotencyKey(idempotencyKey);
        if (replay) return { order: (await db.findOrderById(replay.id))!, replayed: true };
        throw error;
      }
    },
  };
}

/** YP-<base36 timestamp> — readable, unique, aur order id se alag. */
export function buildOrderNumber(at: Date): string {
  return `YP-${at.getTime().toString(36).toUpperCase()}`;
}
