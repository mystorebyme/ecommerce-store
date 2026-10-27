// Purpose: payments: Module tests
//
// Asli business logic ka test: intent → QR → status poll → verify → refund.
// Provider fake hai (network nahi), DB memory hai, par signatures asli HMAC se.

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  capturedUpiPayment,
  createFakeProvider,
  signCheckout,
  TEST_KEY_ID,
  type FakeProvider,
} from "../../../../../tests/fixtures/fake-provider";
import { createMemoryDb, type MemoryDb } from "../../../../../tests/fixtures/memory-db";
import { AppError } from "../../middlewares/error.middleware";
import { createOrdersService } from "../orders/orders.service";
import { createPaymentsService } from "./payments.service";

interface Ctx {
  db: MemoryDb;
  provider: FakeProvider;
  service: ReturnType<typeof createPaymentsService>;
  orderId: string;
  paidEvents: string[];
}

async function setup(nowIso = "2026-10-28T09:00:00.000Z"): Promise<Ctx> {
  const fixedNow = new Date(nowIso);
  const db = createMemoryDb({ now: () => fixedNow });
  db.seedProduct({ id: "kurta", pricePaise: 189900, stock: 5, name: "Kurta" });

  const orders = createOrdersService({ db, now: () => fixedNow });
  const { order } = await orders.create(
    { customerName: "Aarav", customerPhone: "9876543210", items: [{ productId: "kurta", qty: 1 }] },
    "order-key-1",
  );

  const provider = createFakeProvider();
  const paidEvents: string[] = [];
  const service = createPaymentsService({
    db,
    provider,
    now: () => fixedNow,
    config: {
      providerKeyId: TEST_KEY_ID,
      providerName: "razorpay",
      ttlSeconds: 300,
      webBaseUrl: "http://localhost:3000",
    },
    onPaid: (payment) => {
      paidEvents.push(payment.id);
    },
  });

  return { db, provider, service, orderId: order.id, paidEvents };
}

let ctx: Ctx;
beforeEach(async () => {
  ctx = await setup();
});

test("intent: provider order + single-use QR + 5 min TTL", async () => {
  const view = await ctx.service.createIntent({ orderId: ctx.orderId, idempotencyKey: "pay-key-1" });

  assert.equal(view.amountPaise, 189900);
  assert.equal(view.status, "PENDING");
  assert.equal(view.qr.id, "qr_TEST2");
  assert.match(view.qr.qrString ?? "", /^upi:\/\/pay\?/);
  assert.equal(view.checkout.key, TEST_KEY_ID);
  assert.equal(view.checkout.amountPaise, 189900);
  // TTL: provider ko wahi expiry mili jo DB me hai
  assert.equal(ctx.provider.lastQrInput?.amountPaise, 189900);
  assert.equal(view.expiresAt, "2026-10-28T09:05:00.000Z");
});

test("intent: same Idempotency-Key par naya QR nahi banta", async () => {
  const first = await ctx.service.createIntent({ orderId: ctx.orderId, idempotencyKey: "pay-key-1" });
  const second = await ctx.service.createIntent({ orderId: ctx.orderId, idempotencyKey: "pay-key-1" });

  assert.equal(second.paymentId, first.paymentId);
  assert.equal(ctx.provider.calls.createQr, 1);
});

test("intent: QR fail ho to attempt FAILED (aadha-adhoora PENDING nahi)", async () => {
  ctx.provider.failNextQr(new Error("provider down"));
  await assert.rejects(() => ctx.service.createIntent({ orderId: ctx.orderId, idempotencyKey: "pay-key-2" }));

  const payment = await ctx.db.findPaymentByIdempotencyKey("pay-key-2");
  assert.equal(payment?.status, "FAILED");
  assert.equal(payment?.failureReason, "QR_CREATE_FAILED");
});

test("status poll webhook miss hone par bhi server-side verify se PAID karta hai", async () => {
  const view = await ctx.service.createIntent({ orderId: ctx.orderId, idempotencyKey: "pay-key-1" });
  ctx.provider.setQrPayments([capturedUpiPayment({ amountPaise: view.amountPaise })]);

  const status = await ctx.service.getStatus({ paymentId: view.paymentId });

  assert.equal(status.status, "PAID");
  const order = ctx.db.getOrder(ctx.orderId);
  assert.equal(order?.status, "PAID");
  assert.equal(ctx.paidEvents.length, 1, "onPaid side-effect ek hi baar chale");
});

test("amount mismatch ho to PAID nahi hota (ORDER_AMOUNT_MISMATCH)", async () => {
  const view = await ctx.service.createIntent({ orderId: ctx.orderId, idempotencyKey: "pay-key-1" });
  ctx.provider.setQrPayments([capturedUpiPayment({ amountPaise: 100 })]);

  // mismatch par safety-net silently skip karta hai (PAID nahi hota)
  const status = await ctx.service.getStatus({ paymentId: view.paymentId });
  assert.equal(status.status, "PENDING");
});

test("verifyCheckout: sahi signature par PAID", async () => {
  const view = await ctx.service.createIntent({ orderId: ctx.orderId, idempotencyKey: "pay-key-1" });
  ctx.provider.setPayment(capturedUpiPayment({ amountPaise: view.amountPaise, orderId: view.checkout.orderId }));

  const verified = await ctx.service.verifyCheckout({
    paymentId: view.paymentId,
    providerOrderId: view.checkout.orderId,
    providerPaymentId: "pay_TEST123",
    signature: signCheckout(view.checkout.orderId, "pay_TEST123"),
  });

  assert.equal(verified.status, "PAID");
  assert.equal(ctx.db.getPayment(view.paymentId)?.utr, "412345678901");
});

test("verifyCheckout: galat signature par 401", async () => {
  const view = await ctx.service.createIntent({ orderId: ctx.orderId, idempotencyKey: "pay-key-1" });

  await assert.rejects(
    () =>
      ctx.service.verifyCheckout({
        paymentId: view.paymentId,
        providerOrderId: view.checkout.orderId,
        providerPaymentId: "pay_TEST123",
        signature: "deadbeef",
      }),
    (error: unknown) => error instanceof AppError && error.code === "SIGNATURE_INVALID",
  );
});

test("expiry: PENDING attempt timeout par EXPIRED + QR close", async () => {
  const view = await ctx.service.createIntent({ orderId: ctx.orderId, idempotencyKey: "pay-key-1" });

  // 6 minute baad ka naya service instance (clock aage)
  const laterService = createPaymentsService({
    db: ctx.db,
    provider: ctx.provider,
    now: () => new Date("2026-10-28T09:06:00.000Z"),
    config: { providerKeyId: TEST_KEY_ID, providerName: "razorpay", ttlSeconds: 300, webBaseUrl: "" },
  });

  const status = await laterService.getStatus({ paymentId: view.paymentId });
  assert.equal(status.status, "EXPIRED");
  assert.equal(ctx.provider.calls.closeQr, 1);
});

test("expireStale: scheduler pending attempts band karta hai", async () => {
  await ctx.service.createIntent({ orderId: ctx.orderId, idempotencyKey: "pay-key-1" });

  const laterService = createPaymentsService({
    db: ctx.db,
    provider: ctx.provider,
    now: () => new Date("2026-10-28T09:10:00.000Z"),
    config: { providerKeyId: TEST_KEY_ID, providerName: "razorpay", ttlSeconds: 300, webBaseUrl: "" },
  });

  assert.equal(await laterService.expireStale(), 1);
});

test("refund: partial phir full refund", async () => {
  const view = await ctx.service.createIntent({ orderId: ctx.orderId, idempotencyKey: "pay-key-1" });
  ctx.provider.setPayment(capturedUpiPayment({ amountPaise: view.amountPaise, orderId: view.checkout.orderId }));
  await ctx.service.verifyCheckout({
    paymentId: view.paymentId,
    providerOrderId: view.checkout.orderId,
    providerPaymentId: "pay_TEST123",
    signature: signCheckout(view.checkout.orderId, "pay_TEST123"),
  });

  const partial = await ctx.service.refund({ paymentId: view.paymentId, amountPaise: 50000 });
  assert.equal(partial.status, "PARTIALLY_REFUNDED");
  assert.equal(partial.refundedPaise, 50000);

  const rest = await ctx.service.refund({ paymentId: view.paymentId });
  assert.equal(rest.status, "REFUNDED");
  assert.equal(rest.refundedPaise, view.amountPaise);
  assert.equal(ctx.db.getOrder(ctx.orderId)?.status, "REFUNDED");
});

test("refund: unpaid payment par 409", async () => {
  const view = await ctx.service.createIntent({ orderId: ctx.orderId, idempotencyKey: "pay-key-1" });
  await assert.rejects(
    () => ctx.service.refund({ paymentId: view.paymentId }),
    (error: unknown) => error instanceof AppError && error.code === "PAYMENT_NOT_REFUNDABLE",
  );
});
