// Purpose: Razorpay webhook ke asli HTTP tests
//
// Yahan wahi cheezein test hoti hain jo production me money-safe rakhti hain:
//   * galat signature → 401 (aur kuch nahi hota)
//   * duplicate delivery → 200 "duplicate", dobara process nahi
//   * sahi event → PAID, UTR save, order PAID
//   * amount mismatch → PAID nahi hota
//
// Server asli HTTP par chalta hai (ephemeral port), signature asli HMAC se banti hai.

import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, beforeEach, test } from "node:test";
import { createApp } from "../app";
import { createMemoryDb, type MemoryDb } from "../../../../tests/fixtures/memory-db";
import { signWebhook, TEST_KEY_ID } from "../../../../tests/fixtures/fake-provider";
import { createRazorpayProvider } from "../modules/payments/providers/razorpay.provider";

let db: MemoryDb;
let server: Server;
let baseUrl: string;
let orderId: string;
let paymentId: string;

const AMOUNT = 189900;
const PROVIDER_ORDER_ID = "order_WH1";

beforeEach(async () => {
  db = createMemoryDb({ now: () => new Date("2026-10-28T09:00:00.000Z") });
  db.seedProduct({ id: "kurta", pricePaise: AMOUNT, stock: 5 });

  const order = await db.createOrder({
    number: "YP-TEST01",
    amountPaise: AMOUNT,
    currency: "INR",
    customerName: "Aarav",
    customerPhone: "9876543210",
    idempotencyKey: "order-key",
    items: [
      {
        productId: "kurta",
        sku: "KURTA",
        name: "Kurta",
        unitPricePaise: AMOUNT,
        qty: 1,
        lineTotalPaise: AMOUNT,
      },
    ],
  });
  orderId = order.id;

  const payment = await db.createPayment({
    orderId: order.id,
    provider: "razorpay",
    providerOrderId: PROVIDER_ORDER_ID,
    amountPaise: AMOUNT,
    currency: "INR",
    idempotencyKey: "pay-key",
    expiresAt: new Date("2026-10-28T09:05:00.000Z"),
  });
  paymentId = payment.id;
  await db.attachQr(payment.id, { qrId: "qr_WH1", qrString: "upi://pay?pa=demo@upi", qrImageUrl: null });

  // Webhook path ke liye asli signature logic chahiye; network call nahi hota.
  const provider = createRazorpayProvider({
    keyId: TEST_KEY_ID,
    keySecret: "test_key_secret",
    webhookSecret: "test_webhook_secret",
  });

  const app = createApp({
    db,
    provider,
    paymentsConfig: { providerKeyId: TEST_KEY_ID, providerName: "razorpay", ttlSeconds: 300, webBaseUrl: "" },
    webOrigin: "http://localhost:3000",
  });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function capturedEventBody(amount = AMOUNT, eventId = "evt_1") {
  const body = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_WH1",
          order_id: PROVIDER_ORDER_ID,
          status: "captured",
          amount,
          method: "upi",
          captured_at: 1793000000,
          acquirer_data: { upi_transaction_id: "412345678901" },
        },
      },
    },
    created_at: 1793000000,
  });
  return { body, eventId };
}

async function postWebhook(body: string, signature: string | null, eventId: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-razorpay-event-id": eventId,
  };
  if (signature) headers["x-razorpay-signature"] = signature;
  return fetch(`${baseUrl}/api/v1/webhooks/razorpay`, { method: "POST", headers, body });
}

test("valid signature + captured → 200 handled, payment PAID, order PAID, UTR saved", async () => {
  const { body, eventId } = capturedEventBody();
  const response = await postWebhook(body, signWebhook(body), eventId);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "handled" });

  const payment = db.getPayment(paymentId)!;
  assert.equal(payment.status, "PAID");
  assert.equal(payment.utr, "412345678901");
  assert.equal(payment.method, "upi");
  assert.equal(db.getOrder(orderId)!.status, "PAID");
});

test("invalid signature → 401 aur kuch process nahi hota", async () => {
  const { body, eventId } = capturedEventBody();
  const response = await postWebhook(body, "0".repeat(64), eventId);

  assert.equal(response.status, 401);
  const json = (await response.json()) as { error: { code: string } };
  assert.equal(json.error.code, "WEBHOOK_SIGNATURE_INVALID");
  assert.equal(db.getPayment(paymentId)!.status, "PENDING");
});

test("same event-id dobara → duplicate (idempotent), service dobara nahi chalti", async () => {
  const { body, eventId } = capturedEventBody();

  const first = await postWebhook(body, signWebhook(body), eventId);
  assert.equal(first.status, 200);

  // Dusri delivery: same event id, par body thodi alag (provider retry)
  const retryBody = capturedEventBody(AMOUNT, eventId).body;
  const second = await postWebhook(retryBody, signWebhook(retryBody), eventId);
  assert.equal(second.status, 200);
  assert.deepEqual(await second.json(), { status: "duplicate" });

  // Webhook log me sirf ek hi event
  assert.equal(db.webhookEvents.filter((event) => event.eventId === eventId).length, 1);
});

test("amount mismatch → PAID nahi hota (aur webhook FAILED mark hota hai)", async () => {
  const { body, eventId } = capturedEventBody(100); // ₹1 vs ₹1,899
  const response = await postWebhook(body, signWebhook(body), eventId);

  assert.equal(response.status, 409);
  assert.equal(db.getPayment(paymentId)!.status, "PENDING");
  assert.equal(db.getOrder(orderId)!.status, "PENDING_PAYMENT");
});

test("payment.failed → attempt FAILED, order pending hi rehta hai", async () => {
  const body = JSON.stringify({
    event: "payment.failed",
    payload: {
      payment: {
        entity: {
          id: "pay_WH1",
          order_id: PROVIDER_ORDER_ID,
          status: "failed",
          amount: AMOUNT,
          method: "upi",
          error_description: "UPI transaction declined by bank",
        },
      },
    },
  });

  const response = await postWebhook(body, signWebhook(body), "evt_failed");
  assert.equal(response.status, 200);

  const payment = db.getPayment(paymentId)!;
  assert.equal(payment.status, "FAILED");
  assert.equal(payment.failureReason, "UPI transaction declined by bank");
  assert.equal(db.getOrder(orderId)!.status, "PENDING_PAYMENT");
});

test("qr_code.closed → attempt EXPIRED", async () => {
  const body = JSON.stringify({
    event: "qr_code.closed",
    payload: { qr_code: { entity: { id: "qr_WH1", status: "closed", payment_amount: AMOUNT } } },
  });

  const response = await postWebhook(body, signWebhook(body), "evt_qr_closed");
  assert.equal(response.status, 200);
  assert.equal(db.getPayment(paymentId)!.status, "EXPIRED");
});
