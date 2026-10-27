// Purpose: orders: Module tests
//
// Yahan 3 critical rules verify hote hain: server price, atomic stock, idempotency.

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createMemoryDb, type MemoryDb } from "../../../../../tests/fixtures/memory-db";
import { AppError } from "../../middlewares/error.middleware";
import { buildOrderNumber, createOrdersService } from "./orders.service";

let db: MemoryDb;

beforeEach(() => {
  db = createMemoryDb({ now: () => new Date("2026-10-28T09:00:00.000Z") });
  db.seedProduct({ id: "kurta", pricePaise: 189900, stock: 3, name: "Kurta" });
  db.seedProduct({ id: "tote", pricePaise: 129900, stock: 10, name: "Tote" });
});

test("amount server ke products se banta hai (client price bhej bhi nahi sakta)", async () => {
  const service = createOrdersService({ db });
  const { order, replayed } = await service.create(
    { customerName: "Aarav", customerPhone: "9876543210", items: [{ productId: "kurta", qty: 2 }] },
    "key-1",
  );

  assert.equal(replayed, false);
  assert.equal(order.amountPaise, 379800); // 2 x ₹1,899
  assert.equal(order.items[0]!.unitPricePaise, 189900);
  assert.equal(order.items[0]!.lineTotalPaise, 379800);
  assert.match(order.number, /^YP-/);
});

test("same Idempotency-Key dobara aayi to wahi order (naya nahi)", async () => {
  const service = createOrdersService({ db });
  const input = { customerName: "Aarav", customerPhone: "9876543210", items: [{ productId: "tote", qty: 1 }] };

  const first = await service.create(input, "key-same");
  const second = await service.create(input, "key-same");

  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(second.order.id, first.order.id);
});

test("stock kam ho to OUT_OF_STOCK + pehle reserve kiye items rollback", async () => {
  const service = createOrdersService({ db });
  await assert.rejects(
    () =>
      service.create(
        {
          customerName: "Aarav",
          customerPhone: "9876543210",
          items: [
            { productId: "tote", qty: 2 },
            { productId: "kurta", qty: 5 }, // stock sirf 3
          ],
        },
        "key-oos",
      ),
    (error: unknown) => error instanceof AppError && error.code === "OUT_OF_STOCK",
  );

  // rollback verify: tote ka stock wapas 10
  const products = await db.findProductsByIds(["tote", "kurta"]);
  assert.equal(products.find((p) => p.id === "tote")!.stock, 10);
  assert.equal(products.find((p) => p.id === "kurta")!.stock, 3);
});

test("inactive product par PRODUCT_INACTIVE", async () => {
  const db2 = createMemoryDb();
  db2.seedProduct({ id: "old", pricePaise: 10000, stock: 5, active: false });
  const service = createOrdersService({ db: db2 });

  await assert.rejects(
    () =>
      service.create(
        { customerName: "Aarav", customerPhone: "9876543210", items: [{ productId: "old", qty: 1 }] },
        "key-inactive",
      ),
    (error: unknown) => error instanceof AppError && error.code === "PRODUCT_INACTIVE",
  );
});

test("buildOrderNumber: YP- prefix aur unique", () => {
  const a = buildOrderNumber(new Date("2026-10-28T09:00:00.000Z"));
  const b = buildOrderNumber(new Date("2026-10-28T09:00:01.000Z"));
  assert.match(a, /^YP-[0-9A-Z]+$/);
  assert.notEqual(a, b);
});
