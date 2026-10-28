// Purpose: observers tests — exact-amount attribution, cross-source verification,
// duplicate UTR, ambiguous amount, unmatched credit

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createMemoryDb, TEST_MERCHANT, type MemoryDb } from "../../../../../tests/fixtures/memory-db";
import { createGatewayService, type GatewayService } from "./gateway.service";
import { createObserversService, type ObserversService } from "./observers.service";

let db: MemoryDb;
let gateway: GatewayService;
let observers: ObserversService;
let clock: Date;

async function makeOrder(amountPaise: number, key: string): Promise<string> {
  db.seedProduct({ id: `p-${key}`, pricePaise: amountPaise, stock: 5 });
  // Asli orders service stock reserve karta hai — test me bhi wahi (release verify karne ke liye)
  await db.decrementStock(`p-${key}`, 1);
  const order = await db.createOrder({
    number: `YP-${key.toUpperCase()}`,
    amountPaise,
    currency: "INR",
    customerName: "Aarav",
    customerPhone: "9876543210",
    idempotencyKey: key,
    items: [
      {
        productId: `p-${key}`,
        sku: key.toUpperCase(),
        name: `Item ${key}`,
        unitPricePaise: amountPaise,
        qty: 1,
        lineTotalPaise: amountPaise,
      },
    ],
  });
  return order.id;
}

beforeEach(async () => {
  clock = new Date("2026-10-28T09:00:00.000Z");
  db = createMemoryDb({ now: () => clock });
  await db.upsertMerchant({
    name: TEST_MERCHANT.name,
    vpa: TEST_MERCHANT.vpa,
    payeeName: TEST_MERCHANT.payeeName,
    webhookUrl: TEST_MERCHANT.webhookUrl,
    webhookSecret: TEST_MERCHANT.webhookSecret,
    payWindowSeconds: 300,
    verifyWindowSeconds: 30,
  });
  gateway = createGatewayService({ db, now: () => clock });
  observers = createObserversService({ db, gateway, now: () => clock });
});

test("trusted Android SMS → exact amount match → SUCCESS, order PAID", async () => {
  const orderId = await makeOrder(189900, "o1");
  const session = await gateway.startForOrder({ orderId });

  const result = await observers.ingest({
    source: "ANDROID_SMS",
    deviceId: "pixel-7",
    messageId: "sms-1",
    rawText: "Rs.1,899.00 credited to your a/c XX1234. UPI ref 412345678901.",
  });

  assert.equal(result.verdict, "SUCCESS");
  assert.equal(result.session?.status, "SUCCESS");
  assert.equal(result.session?.utr, "412345678901");
  assert.equal(db.getOrder(orderId)!.status, "PAID");
  assert.equal(db.observations.length, 1);
  assert.equal(db.observations[0]!.status, "MATCHED");
  void session;
});

test("GMAIL (akela) → PROCESSING, dusra source → SUCCESS", async () => {
  const orderId = await makeOrder(74900, "o1");
  const session = await gateway.startForOrder({ orderId });

  const first = await observers.ingest({
    source: "GMAIL",
    deviceId: "gmail-watcher",
    messageId: "mail-1",
    rawText: "INR 749 credited to your a/c XX1234 from aarav@oksbi. UTR 412345670001",
  });
  assert.equal(first.verdict, "PROCESSING");
  assert.equal(db.getSession(session.sessionId)!.status, "PROCESSING");
  assert.equal(db.getOrder(orderId)!.status, "PENDING_PAYMENT", "single source par paisa PAID nahi hota");

  const second = await observers.ingest({
    source: "MESSAGES",
    deviceId: "messages-web",
    messageId: "msg-1",
    amountPaise: 74900,
    utr: "412345670001",
    senderVpa: "aarav@oksbi",
  });
  assert.equal(second.verdict, "SUCCESS");
  assert.equal(db.getOrder(orderId)!.status, "PAID");
});

test("same UTR dobara → DUPLICATE, order dobara settle nahi hota", async () => {
  const orderId = await makeOrder(189900, "o1");
  await gateway.startForOrder({ orderId });

  await observers.ingest({
    source: "ANDROID_SMS",
    deviceId: "pixel-7",
    messageId: "sms-1",
    amountPaise: 189900,
    utr: "412345678901",
  });
  const replay = await observers.ingest({
    source: "ANDROID_SMS",
    deviceId: "pixel-7",
    messageId: "sms-2",
    amountPaise: 189900,
    utr: "412345678901",
  });

  assert.equal(replay.verdict, "DUPLICATE");
  assert.equal(db.deliveries.length <= 1, true);
});

test("koi matching session nahi → UNMATCHED (paisa aaya par order nahi)", async () => {
  const result = await observers.ingest({
    source: "ANDROID_SMS",
    deviceId: "pixel-7",
    messageId: "sms-9",
    amountPaise: 123400,
    utr: "412340000009",
  });

  assert.equal(result.verdict, "UNMATCHED");
  assert.equal(result.session, null);
});

test("same amount ke 2 sessions + note me reference → sahi session match", async () => {
  const firstId = await makeOrder(50000, "o1");
  const secondId = await makeOrder(50000, "o2");
  const first = await gateway.startForOrder({ orderId: firstId });
  const second = await gateway.startForOrder({ orderId: secondId });

  // Dono ₹500 — note (tn) second session ka reference hai
  const result = await observers.ingest({
    source: "ANDROID_SMS",
    deviceId: "pixel-7",
    messageId: "sms-3",
    rawText: `Rs.500.00 credited. UPI ref 412345670123 tn ${second.reference}`,
  });

  assert.equal(result.verdict, "SUCCESS");
  assert.equal(result.session?.id, second.sessionId);
  assert.equal(db.getSession(first.sessionId)!.status, "ACTIVE", "pehla session untouched");
});

test("same amount ke 2 sessions + note nahi → SUSPICIOUS (guess nahi karte)", async () => {
  await gateway.startForOrder({ orderId: await makeOrder(50000, "o1") });
  await gateway.startForOrder({ orderId: await makeOrder(50000, "o2") });

  const result = await observers.ingest({
    source: "ANDROID_SMS",
    deviceId: "pixel-7",
    messageId: "sms-4",
    amountPaise: 50000,
    utr: "412345670456",
  });

  assert.equal(result.verdict, "SUSPICIOUS");
  assert.equal(result.session, null);
});

test("parse na hone wala SMS → 422 UNPARSEABLE_MESSAGE", async () => {
  await assert.rejects(
    () =>
      observers.ingest({
        source: "ANDROID_SMS",
        deviceId: "pixel-7",
        messageId: "sms-5",
        rawText: "Your OTP for login is 4321. Do not share.",
      }),
    (error: unknown) => (error as { code?: string }).code === "UNPARSEABLE_MESSAGE",
  );
});

test("debit SMS reject hota hai", async () => {
  await assert.rejects(
    () =>
      observers.ingest({
        source: "ANDROID_SMS",
        deviceId: "pixel-7",
        messageId: "sms-6",
        rawText: "Rs.500.00 debited from your a/c. UPI ref 412345670789.",
      }),
    (error: unknown) => (error as { code?: string }).code === "NOT_A_CREDIT",
  );
});
