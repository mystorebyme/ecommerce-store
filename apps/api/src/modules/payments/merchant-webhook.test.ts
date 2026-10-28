// Purpose: merchant webhook tests — signing, retry backoff, exhaustion

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createMemoryDb, TEST_MERCHANT, type MemoryDb } from "../../../../../tests/fixtures/memory-db";
import { createGatewayService } from "../gateway/gateway.service";
import {
  buildPaymentSuccessPayload,
  createMerchantWebhookService,
  signPayload,
} from "./merchant-webhook.service";

let db: MemoryDb;
let clock: Date;
let received: { url: string; body: string; headers: Record<string, string> }[];
let respond: () => Response;

beforeEach(async () => {
  clock = new Date("2026-10-28T09:00:00.000Z");
  db = createMemoryDb({ now: () => clock });
  await db.upsertMerchant({
    name: TEST_MERCHANT.name,
    vpa: TEST_MERCHANT.vpa,
    payeeName: TEST_MERCHANT.payeeName,
    webhookUrl: TEST_MERCHANT.webhookUrl,
    webhookSecret: TEST_MERCHANT.webhookSecret,
  });
  received = [];
  respond = () => new Response("ok", { status: 200 });
});

function fakeHttp(): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    received.push({ url: String(url), body: String(init?.body ?? ""), headers });
    return respond();
  }) as typeof fetch;
}

async function settledSession() {
  db.seedProduct({ id: "p1", pricePaise: 189900, stock: 5 });
  const order = await db.createOrder({
    number: "YP-AAAA01",
    amountPaise: 189900,
    currency: "INR",
    customerName: "Aarav",
    customerPhone: "9876543210",
    idempotencyKey: "k1",
    items: [
      { productId: "p1", sku: "P1", name: "Kurta", unitPricePaise: 189900, qty: 1, lineTotalPaise: 189900 },
    ],
  });
  const gateway = createGatewayService({ db, now: () => clock });
  const view = await gateway.startForOrder({ orderId: order.id });
  const session = await gateway.settle({ sessionId: view.sessionId, utr: "412345678901", senderVpa: "aarav@oksbi" });
  return { order: (await db.findOrderById(order.id))!, session };
}

test("payload shape: integer paise + UTR + event", async () => {
  const { order, session } = await settledSession();
  const payload = buildPaymentSuccessPayload({ session, order, utr: "412345678901", at: clock });

  assert.equal(payload.event, "payment.success");
  assert.equal(payload.amountPaise, 189900);
  assert.equal(payload.utr, "412345678901");
  assert.equal(payload.orderNumber, "YP-AAAA01");
  assert.equal(payload.currency, "INR");
});

test("sahi signature ke saath delivery jaati hai", async () => {
  const webhooks = createMerchantWebhookService({ db, now: () => clock, http: fakeHttp() });
  const { order, session } = await settledSession();
  const merchant = (await db.getMerchant())!;

  await webhooks.dispatch({ session, order, merchant, utr: "412345678901" });

  assert.equal(received.length, 1);
  const [request] = received;
  assert.equal(request!.url, TEST_MERCHANT.webhookUrl);
  assert.match(request!.headers["x-youpi-delivery-id"] ?? "", /^dlv_/);
  assert.equal(request!.headers["x-youpi-event"], "payment.success");
  // Signature asli HMAC se verify hoti hai (merchant side par yahi karna hai)
  assert.equal(request!.headers["x-youpi-signature"], signPayload(request!.body, TEST_MERCHANT.webhookSecret!));
  assert.equal(db.deliveries[0]!.status, "DELIVERED");
});

test("failure par retry backoff, 5 attempts ke baad FAILED", async () => {
  respond = () => new Response("server error", { status: 500 });
  const webhooks = createMerchantWebhookService({ db, now: () => clock, http: fakeHttp() });
  const { order, session } = await settledSession();
  const merchant = (await db.getMerchant())!;

  await webhooks.dispatch({ session, order, merchant, utr: "412345678901" });
  let delivery = db.deliveries[0]!;
  assert.equal(delivery.attempts, 1);
  assert.equal(delivery.status, "PENDING");
  assert.equal(delivery.lastStatusCode, 500);

  // 30s baad retry
  clock = new Date("2026-10-28T09:00:31.000Z");
  await webhooks.processDue();
  delivery = db.deliveries[0]!;
  assert.equal(delivery.attempts, 2);

  // Backoff ke andar early call par kuch nahi hota
  await webhooks.processDue();
  assert.equal(db.deliveries[0]!.attempts, 2);

  // Attempts khatam
  for (let index = 0; index < 5; index += 1) {
    clock = new Date(clock.getTime() + 31 * 60 * 1000);
    await webhooks.processDue();
  }
  assert.equal(db.deliveries[0]!.status, "FAILED");
});

test("webhook URL nahi hai to delivery nahi banti", async () => {
  await db.upsertMerchant({
    name: TEST_MERCHANT.name,
    vpa: TEST_MERCHANT.vpa,
    payeeName: TEST_MERCHANT.payeeName,
    webhookUrl: null,
    webhookSecret: null,
  });
  const webhooks = createMerchantWebhookService({ db, now: () => clock, http: fakeHttp() });
  const { order, session } = await settledSession();
  const merchant = (await db.getMerchant())!;

  const delivery = await webhooks.dispatch({ session, order, merchant, utr: "412345678901" });
  assert.equal(delivery, null);
  assert.equal(received.length, 0);
});
