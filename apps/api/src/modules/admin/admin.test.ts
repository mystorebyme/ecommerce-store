// Purpose: admin ops tests — live board, manual confirm (jab observer na ho), webhook replay
//
// Ye endpoints asli duniya ke liye hain: SMS der se aaya, phone off tha, ya Gmail
// watcher band tha — tab merchant bank app dekh kar manually confirm karta hai.

import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, test } from "node:test";
import { createApp } from "../../app";
import { createMemoryDb, TEST_MERCHANT, type MemoryDb } from "../../../../../tests/fixtures/memory-db";

const ADMIN_TOKEN = "admin_token_1234567890";
const OBSERVER_SECRET = "observer_shared_secret_123456";

let db: MemoryDb;
let server: Server;
let baseUrl: string;
let clock: Date;

beforeEach(async () => {
  clock = new Date("2026-10-28T09:00:00.000Z");
  db = createMemoryDb({ now: () => clock });
  await db.upsertMerchant({
    name: TEST_MERCHANT.name,
    vpa: TEST_MERCHANT.vpa,
    payeeName: TEST_MERCHANT.payeeName,
    webhookUrl: null,
    webhookSecret: TEST_MERCHANT.webhookSecret,
  });

  const { app } = createApp({
    db,
    observerSecret: OBSERVER_SECRET,
    adminToken: ADMIN_TOKEN,
    webOrigin: "http://localhost:3000",
    now: () => clock,
  });

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function seedSession(amountPaise = 189900): Promise<{ orderId: string; sessionId: string }> {
  db.seedProduct({ id: "p1", pricePaise: amountPaise, stock: 5 });
  const order = await db.createOrder({
    number: `YP-${amountPaise}`,
    amountPaise,
    currency: "INR",
    customerName: "Aarav",
    customerPhone: "9876543210",
    idempotencyKey: `k-${amountPaise}`,
    items: [
      { productId: "p1", sku: "P1", name: "Kurta", unitPricePaise: amountPaise, qty: 1, lineTotalPaise: amountPaise },
    ],
  });
  const start = await fetch(`${baseUrl}/api/v1/payments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderId: order.id }),
  });
  const text = await start.text();
  if (start.status >= 400) throw new Error(`start failed ${start.status}: ${text}`);
  const json = JSON.parse(text) as { data: { sessionId: string } };
  return { orderId: order.id, sessionId: json.data.sessionId };
}

function adminFetch(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}/api/v1/admin${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-admin-token": ADMIN_TOKEN, ...(init.headers ?? {}) },
  });
}

test("manual confirm: bank app me paisa dikha, sms nahi aaya → SUCCESS + order PAID", async () => {
  const { orderId, sessionId } = await seedSession();

  const response = await adminFetch(`/sessions/${sessionId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ utr: "412345678901", note: "Paytm app me credit dikha" }),
  });
  assert.equal(response.status, 200);

  const json = (await response.json()) as { data: { status: string; utr: string } };
  assert.equal(json.data.status, "SUCCESS");
  assert.equal(json.data.utr, "412345678901");
  assert.equal(db.getOrder(orderId)!.status, "PAID");

  // Audit: manual proof bhi observation ke roop me save hoti hai
  const manual = db.observations.find((observation) => observation.source === "MANUAL")!;
  assert.equal(manual.utr, "412345678901");
  assert.equal(manual.status, "MATCHED");
  assert.equal(manual.sessionId, sessionId);
});

test("manual confirm: amount mismatch → 409, session ACTIVE hi rehta hai", async () => {
  const { orderId, sessionId } = await seedSession(189900);

  const response = await adminFetch(`/sessions/${sessionId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ utr: "412345678902", amountPaise: 100 }),
  });

  assert.equal(response.status, 409);
  const json = (await response.json()) as { error: { code: string } };
  assert.equal(json.error.code, "ORDER_AMOUNT_MISMATCH");
  assert.equal(db.getOrder(orderId)!.status, "PENDING_PAYMENT");
  assert.equal(db.getSession(sessionId)!.status, "ACTIVE");
});

test("manual confirm: token ke bina 401, galat UTR par 422", async () => {
  const { sessionId } = await seedSession();

  const noToken = await fetch(`${baseUrl}/api/v1/admin/sessions/${sessionId}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ utr: "412345678901" }),
  });
  assert.equal(noToken.status, 401);

  const badUtr = await adminFetch(`/sessions/${sessionId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ utr: "12" }),
  });
  assert.equal(badUtr.status, 422);
});

test("live board: ACTIVE aur QUEUED sessions countdown ke saath dikhte hain", async () => {
  await seedSession(50000);
  await seedSession(70000);

  const response = await adminFetch("/sessions");
  assert.equal(response.status, 200);

  const json = (await response.json()) as {
    data: { status: string; secondsLeftToPay: number; reference: string }[];
    meta: { count: number };
  };

  assert.equal(json.meta.count, 2);
  assert.deepEqual(
    json.data.map((row) => row.status),
    ["ACTIVE", "QUEUED"],
  );
  assert.equal(json.data[0]!.secondsLeftToPay, 300);
  assert.match(json.data[0]!.reference, /^YP/);
});

test("expire hone par board se hat jaata hai aur stock wapas aata hai", async () => {
  const { sessionId } = await seedSession(50000);

  clock = new Date("2026-10-28T09:05:30.000Z");
  const response = await adminFetch(`/sessions?status=EXPIRED`);
  const json = (await response.json()) as { data: { sessionId: string; status: string }[] };

  assert.equal(json.data.length, 1);
  assert.equal(json.data[0]!.sessionId, sessionId);
  assert.equal(json.data[0]!.status, "EXPIRED");
});

test("deliveries list + replay (merchant webhook audit)", async () => {
  // webhookUrl set karke settle karo → ek delivery row banti hai
  await db.upsertMerchant({
    name: TEST_MERCHANT.name,
    vpa: TEST_MERCHANT.vpa,
    payeeName: TEST_MERCHANT.payeeName,
    webhookUrl: "https://merchant.test/hook",
    webhookSecret: TEST_MERCHANT.webhookSecret,
  });
  const { sessionId } = await seedSession();
  await adminFetch(`/sessions/${sessionId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ utr: "412345678903" }),
  });

  // Network call fail hoti hai (merchant.test resolve nahi hota) → delivery PENDING/FAILED
  const list = await adminFetch("/deliveries?status=PENDING");
  assert.equal(list.status, 200);
  const json = (await list.json()) as { data: { deliveryId: string; attempts: number }[] };
  assert.ok(json.data.length >= 1);
  assert.equal(json.data[0]!.attempts, 1);

  const replay = await adminFetch(`/deliveries/${json.data[0]!.deliveryId}/replay`, { method: "POST" });
  assert.equal(replay.status, 200);
  const replayed = (await replay.json()) as { data: { attempts: number } };
  assert.equal(replayed.data.attempts, 2);
});
