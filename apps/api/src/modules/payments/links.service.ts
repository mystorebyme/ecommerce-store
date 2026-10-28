// Purpose: Payment links — fixed (amount locked) aur open (buyer amount daale)
//
// Rules (ADR-0012):
//   * Public URL me sirf **token** jaata hai; amount/limits server DB se aate hain.
//     Isliye URL tamper karne se amount nahi badal sakta (koi client-side amount nahi).
//   * FIXED: request ka `amountPaise` **ignore** hota hai — DB ka amount jeetta hai.
//   * OPEN: amount settings ke min/max ke andar, integer paise.
//   * Har link par `maxUses` + `expiresAt`; use atomic (`consumePaymentLinkUse`) —
//     race me limit se zyada use nahi ho sakta.
//   * Paisa confirm sirf observer/manual se — link ka apna koi "paid" signal nahi.

import { randomBytes } from "node:crypto";
import type { CreatePaymentLinkRecord, Db, PaymentLinkRow, PaymentLinkStatus } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import type { SettingsService } from "../settings/settings.service";

/** Hidden product — order item ko valid Product FK chahiye. Catalog me nahi dikhta. */
export const LINK_PRODUCT = {
  id: "prod_paylink",
  sku: "PAYLINK-001",
  name: "Payment Link",
  pricePaise: 100,
  stock: 999_999,
} as const;

export interface PublicLinkView {
  token: string;
  kind: "FIXED" | "OPEN";
  title: string;
  note: string;
  status: "ACTIVE" | "EXPIRED" | "DISABLED" | "USED_UP";
  amountPaise: number | null;
  minAmountPaise: number | null;
  maxAmountPaise: number | null;
  expiresAt: string | null;
  remainingUses: number;
  payee: { name: string; vpa: string };
}

export interface StartLinkInput {
  token: string;
  customerName: string;
  customerPhone: string;
  amountPaise?: number;
}

export interface LinksService {
  ensureProduct(): Promise<void>;
  create(
    input: {
      kind: "FIXED" | "OPEN";
      title: string;
      note?: string;
      amountPaise?: number;
      maxUses?: number;
      expiresInHours?: number;
    },
    actor: string,
  ): Promise<PaymentLinkRow>;
  list(limit?: number): Promise<PaymentLinkRow[]>;
  disable(id: string, actor: string, ctx: { ip?: string | null; requestId?: string | null }): Promise<PaymentLinkRow>;
  publicView(token: string): Promise<PublicLinkView>;
  /** Order + payment session — amount server decide karta hai. */
  start(input: StartLinkInput): Promise<{ orderId: string; sessionId: string; amountPaise: number; token: string }>;
  /** Bina link ke "kuch bhi pay karo" — limits settings se, amount server validate karta hai. */
  startOpen(input: {
    amountPaise: number;
    customerName: string;
    customerPhone: string;
    note?: string;
  }): Promise<{ orderId: string; sessionId: string; amountPaise: number }>;
}

function slugifyNote(value: string): string {
  // UPI `tn` 6-40 chars: sirf alnum + space + dash.
  return value.replace(/[^a-zA-Z0-9 -]/g, "").trim().slice(0, 34) || "YouPI Store";
}

export function createLinksService({
  db,
  settings,
  gateway,
  now = () => new Date(),
}: {
  db: Db;
  settings: SettingsService;
  gateway: { startForOrder(input: { orderId: string }): Promise<{ sessionId: string }> };
  now?: () => Date;
}): LinksService {
  async function ensureProduct(): Promise<void> {
    await db.upsertProductBySku({ ...LINK_PRODUCT });
  }

  async function statusOf(link: PaymentLinkRow): Promise<PublicLinkView["status"]> {
    if (link.status === "DISABLED") return "DISABLED";
    if (link.expiresAt && link.expiresAt.getTime() <= now().getTime()) return "EXPIRED";
    if (link.usedCount >= link.maxUses) return "USED_UP";
    return "ACTIVE";
  }

  const service: LinksService = {
    ensureProduct,

    async create(input, actor) {
      const merchant = await db.getMerchant();
      if (!merchant) throw AppError.unavailable("MERCHANT_NOT_CONFIGURED", "Pehle merchant VPA set karo.");
      await ensureProduct();

      const limits = await settings.limits();
      const record: CreatePaymentLinkRecord = {
        token: randomBytes(9).toString("base64url"),
        kind: input.kind,
        title: input.title,
        note: slugifyNote(input.note ?? input.title),
        amountPaise: input.kind === "FIXED" ? (input.amountPaise ?? null) : null,
        minAmountPaise: input.kind === "OPEN" ? limits.minAmountPaise : null,
        maxAmountPaise: input.kind === "OPEN" ? limits.maxAmountPaise : null,
        maxUses: input.maxUses ?? 1000,
        expiresAt: input.expiresInHours ? new Date(now().getTime() + input.expiresInHours * 3_600_000) : null,
        createdBy: actor,
      };

      const link = await db.createPaymentLink(record);
      await db.appendAudit({
        actor,
        action: "links.created",
        entity: "payment_link",
        entityId: link.id,
        after: JSON.stringify({ kind: link.kind, amountPaise: link.amountPaise, maxUses: link.maxUses }),
      });
      return link;
    },

    async list(limit = 50) {
      return db.listPaymentLinks(limit);
    },

    async disable(id, actor, ctx) {
      const link = await db.findPaymentLinkById(id);
      if (!link) throw AppError.notFound("LINK_NOT_FOUND", "Payment link nahi mila.");
      const updated = await db.updatePaymentLink(id, { status: "DISABLED" as PaymentLinkStatus });
      await db.appendAudit({
        actor,
        action: "links.disabled",
        entity: "payment_link",
        entityId: id,
        before: JSON.stringify({ status: link.status }),
        after: JSON.stringify({ status: "DISABLED" }),
        ip: ctx.ip ?? null,
        requestId: ctx.requestId ?? null,
      });
      return updated ?? link;
    },

    async publicView(token) {
      const link = await db.findPaymentLinkByToken(token);
      if (!link) throw AppError.notFound("LINK_NOT_FOUND", "Ye payment link maujood nahi hai.");
      const merchant = await db.getMerchant();
      if (!merchant) throw AppError.unavailable("MERCHANT_NOT_CONFIGURED", "Merchant configure nahi hai.");

      return {
        token: link.token,
        kind: link.kind,
        title: link.title,
        note: link.note,
        status: await statusOf(link),
        amountPaise: link.amountPaise,
        minAmountPaise: link.minAmountPaise,
        maxAmountPaise: link.maxAmountPaise,
        expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
        remainingUses: Math.max(0, link.maxUses - link.usedCount),
        payee: { name: merchant.payeeName, vpa: merchant.vpa },
      };
    },

    async startOpen(input) {
      const merchant = await db.getMerchant();
      if (!merchant) throw AppError.unavailable("MERCHANT_NOT_CONFIGURED", "Merchant configure nahi hai.");

      const limits = await settings.limits();
      const amountPaise = input.amountPaise;
      if (!Number.isInteger(amountPaise) || amountPaise < limits.minAmountPaise || amountPaise > limits.maxAmountPaise) {
        throw AppError.badRequest(
          "AMOUNT_OUT_OF_RANGE",
          `Amount ₹${(limits.minAmountPaise / 100).toFixed(0)} se ₹${(limits.maxAmountPaise / 100).toFixed(0)} ke beech hona chahiye.`,
        );
      }

      await ensureProduct();
      const order = await db.createOrder({
        number: `YP-${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`,
        amountPaise,
        currency: "INR",
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        idempotencyKey: `open:${Date.now()}:${randomBytes(4).toString("hex")}`,
        items: [
          {
            productId: LINK_PRODUCT.id,
            sku: LINK_PRODUCT.sku,
            name: `${LINK_PRODUCT.name} — ${slugifyNote(input.note ?? "Custom payment")}`,
            unitPricePaise: amountPaise,
            qty: 1,
            lineTotalPaise: amountPaise,
          },
        ],
      });

      const session = await gateway.startForOrder({ orderId: order.id });
      return { orderId: order.id, sessionId: session.sessionId, amountPaise };
    },

    async start(input) {
      const link = await db.findPaymentLinkByToken(input.token);
      if (!link) throw AppError.notFound("LINK_NOT_FOUND", "Ye payment link maujood nahi hai.");

      const status = await statusOf(link);
      if (status !== "ACTIVE") {
        throw AppError.conflict("LINK_NOT_PAYABLE", `Ye link ab ${status.toLowerCase().replace("_", " ")} hai.`);
      }

      // Amount ka faisla server karta hai.
      let amountPaise: number;
      if (link.kind === "FIXED") {
        amountPaise = link.amountPaise ?? 0; // request ka amount yahan bilkul ignore
      } else {
        const limits = await settings.limits();
        const min = link.minAmountPaise ?? limits.minAmountPaise;
        const max = link.maxAmountPaise ?? limits.maxAmountPaise;
        amountPaise = input.amountPaise ?? 0;
        if (!Number.isInteger(amountPaise) || amountPaise < min || amountPaise > max) {
          throw AppError.badRequest(
            "AMOUNT_OUT_OF_RANGE",
            `Amount ₹${(min / 100).toFixed(0)} se ₹${(max / 100).toFixed(0)} ke beech, paise me integer hona chahiye.`,
          );
        }
      }
      if (!Number.isInteger(amountPaise) || amountPaise < 100) {
        throw AppError.badRequest("AMOUNT_INVALID", "Amount kam se kam ₹1 hona chahiye.");
      }

      await ensureProduct();
      const merchant = await db.getMerchant();
      if (!merchant) throw AppError.unavailable("MERCHANT_NOT_CONFIGURED", "Merchant configure nahi hai.");

      // Atomic use-count: limit cross nahi hoti.
      const consumed = await db.consumePaymentLinkUse(link.id);
      if (!consumed) throw AppError.conflict("LINK_EXHAUSTED", "Ye link ki limit poori ho gayi hai.");

      const order = await db.createOrder({
        number: `YP-${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`,
        amountPaise,
        currency: "INR",
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        // Link payment ka apna idempotency domain — token + timestamp + random.
        idempotencyKey: `link:${link.id}:${Date.now()}:${randomBytes(4).toString("hex")}`,
        linkId: link.id,
        items: [
          {
            productId: LINK_PRODUCT.id,
            sku: LINK_PRODUCT.sku,
            name: `${LINK_PRODUCT.name} — ${link.title}`,
            unitPricePaise: amountPaise,
            qty: 1,
            lineTotalPaise: amountPaise,
          },
        ],
      });

      const session = await gateway.startForOrder({ orderId: order.id });
      return { orderId: order.id, sessionId: session.sessionId, amountPaise, token: link.token };
    },
  };

  return service;
}
