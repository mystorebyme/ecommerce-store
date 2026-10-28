// Purpose: observer webhook ke asli HTTP tests
//
// Yahan wahi cheezein test hoti hain jo production me paisa-safe rakhti hain:
//   * signature missing/galat → 401, kuch process nahi
//   * sahi signature + trusted SMS → payment SUCCESS + order PAID
//   * duplicate message → verdict DUPLICATE
//   * raw body hi parse hota hai (express.json se pehle mount)

import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, test } from "node:test";
import { createApp } from "../app";
import { createMemoryDb, TEST_MERCHANT, type MemoryDb } from "../../../../tests/fixtures/memory-db";
import { signPayload } from "../modules/payments/merchant-webhook.service";
import { createGatewayService } from "../modules/gateway/gateway.service";

const OBSERVER_SECRET = "observer_shared_secret_123456";
const ADMIN_TOKEN = "admin_token_1234567890";

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

async function seedOrderAndSession(amountPaise = 189900): Promise<{ orderId: string; sessionId: string }> {
  db.seedProduct({ id: "p1", pricePaise: amountPaise, stock: 5 });
  const order = await db.createOrder({
    number: "YP-AAAA01",
    amountPaise,
    currency: "INR",
    customerName: "Aarav",
    customerPhone: "9876543210",
    idempotencyKey: `k-${amountPaise}`,
    items: [
      {
        productId: "p1",
        sku: "P1",
        name: "Kurta",
        unitPricePaise: amountPaise,
        qty: 1,
        lineTotalPaise: amountPaise,
      },
    ],
  });
  const gateway = createGatewayService({ db, now: () => clock });
  const view = await gateway.startForOrder({ orderId: order.id });
  return { orderId: order.id, sessionId: view.sessionId };
}

function postObservation(body: unknown, signature?: string) {
  const raw = JSON.stringify(body);
  return fetch(`${baseUrl}/api/v1/observers/observations`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signature ? { "x-observer-signature": signature } : {}),
    },
    body: raw,
  });
}

test("signature ke bina → 401 aur kuch process nahi", async () => {
  const { orderId } = await seedOrderAndSession();
  const response = await postObservation({
    source: "ANDROID_SMS",
    deviceId: "pixel",
    messageId: "m1",
    rawText: "Rs.1,899.00 credited. UPI ref 412345678901.",
  });

  assert.equal(response.status, 401);
  assert.equal(db.getOrder(orderId)!.status, "PENDING_PAYMENT");
  assert.equal(db.observations.length, 0);
});

test("sahi signature + trusted SMS → SUCCESS, order PAID", async () => {
  const { orderId, sessionId } = await seedOrderAndSession();
  const body = {
    source: "ANDROID_SMS",
    deviceId: "pixel",
    messageId: "m1",
    rawText: "Rs.1,899.00 credited to your a/c XX1234. UPI ref 412345678901.",
  };

  const response = await postObservation(body, signPayload(JSON.stringify(body), OBSERVER_SECRET));
  assert.equal(response.status, 200);

  const json = (await response.json()) as { data: { verdict: string; status: string; sessionId: string } };
  assert.equal(json.data.verdict, "SUCCESS");
  assert.equal(json.data.status, "SUCCESS");
  assert.equal(json.data.sessionId, sessionId);
  assert.equal(db.getOrder(orderId)!.status, "PAID");
});

test("galat signature (different secret) → 401", async () => {
  await seedOrderAndSession();
  const body = { source: "ANDROID_SMS", deviceId: "pixel", messageId: "m1", amountPaise: 189900, utr: "412345678901" };
  const response = await postObservation(body, signPayload(JSON.stringify(body), "wrong_secret_00000000"));

  assert.equal(response.status, 401);
  assert.equal(db.observations.length, 0);
});

test("duplicate message → verdict DUPLICATE", async () => {
  await seedOrderAndSession();
  const body = { source: "ANDROID_SMS", deviceId: "pixel", messageId: "m1", amountPaise: 189900, utr: "412345678901" };
  const signature = signPayload(JSON.stringify(body), OBSERVER_SECRET);

  const first = (await (await postObservation(body, signature)).json()) as { data: { verdict: string } };
  const second = (await (await postObservation(body, signature)).json()) as { data: { verdict: string } };

  assert.equal(first.data.verdict, "SUCCESS");
  assert.equal(second.data.verdict, "DUPLICATE");
});

test("health endpoint gateway config dikhata hai", async () => {
  await seedOrderAndSession();
  const response = await fetch(`${baseUrl}/api/v1/health`);
  const json = (await response.json()) as Record<string, unknown>;

  assert.equal(json.status, "ok");
  assert.equal(json.gateway, "youpi-selfhosted");
  assert.equal(json.merchantVpa, TEST_MERCHANT.vpa);
  assert.equal(json.observersEnabled, true);
});

test("admin merchant config: token ke bina 401, token ke saath update", async () => {
  const without = await fetch(`${baseUrl}/api/v1/admin/merchant`);
  assert.equal(without.status, 401);

  const update = await fetch(`${baseUrl}/api/v1/admin/merchant`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": ADMIN_TOKEN },
    body: JSON.stringify({
      name: "Demo Store",
      vpa: "newstore@okaxis",
      payeeName: "Demo Store",
      webhookUrl: "https://merchant.test/hook",
      webhookSecret: "whsec_new_secret_123456",
      payWindowSeconds: 240,
    }),
  });
  assert.equal(update.status, 200);

  const json = (await update.json()) as { data: { vpa: string; payWindowSeconds: number; webhookSecretSet: boolean } };
  assert.equal(json.data.vpa, "newstore@okaxis");
  assert.equal(json.data.payWindowSeconds, 240);
  assert.equal(json.data.webhookSecretSet, true);
});

test("payment start API: order → session + UPI QR", async () => {
  const { orderId } = await seedOrderAndSession(74900);
  const response = await fetch(`${baseUrl}/api/v1/payments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
  assert.equal(response.status, 201);

  const json = (await response.json()) as { data: { status: string; upi: { string: string; dataUrl: string } } };
  assert.equal(json.data.status, expectActiveOrQueued());
  assert.match(json.data.upi.string, /^upi:\/\/pay\?pa=/);
  assert.match(json.data.upi.dataUrl, /^data:image\/svg\+xml;base64,/);
});

function expectActiveOrQueued(): string {
  // Har test independent DB par chalta hai — pehla session ACTIVE hi hoga.
  return "ACTIVE";
}

test("observer token mode: x-observer-token se credit accept hota hai (forwarder apps)", async () => {
  const body = JSON.stringify({
    source: "ANDROID_SMS",
    deviceId: "forwarder-app-1",
    messageId: "tok-msg-1",
    amountPaise: 50000,
    utr: "555666777888",
  });

  const response = await fetch(`${baseUrl}/api/v1/observers/observations`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-observer-token": OBSERVER_SECRET },
    body,
  });

  assert.equal(response.status, 200);
  const json = (await response.json()) as { data: { verdict: string } };
  assert.equal(json.data.verdict, "UNMATCHED"); // koi live session nahi → unmatched (par accepted)
});

test("observer token mode: galat token 401", async () => {
  const response = await fetch(`${baseUrl}/api/v1/observers/observations`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-observer-token": "wrong_token_wrong_token" },
    body: JSON.stringify({
      source: "ANDROID_SMS",
      deviceId: "forwarder-app-2",
      messageId: "tok-msg-2",
      amountPaise: 1000,
      utr: "555666777999",
    }),
  });

  assert.equal(response.status, 401);
});

test("plain text forwarder: sirf SMS text + token bhejo, server khud parse karta hai", async () => {
  const sms = "Your a/c XX4412 credited Rs 750.00 on 28-10-26. UPI ref 999888777666";

  const response = await fetch(`${baseUrl}/api/v1/observers/observations`, {
    method: "POST",
    headers: { "content-type": "text/plain", "x-observer-token": OBSERVER_SECRET },
    body: sms,
  });

  assert.equal(response.status, 200);
  const json = (await response.json()) as { data: { verdict: string } };
  assert.equal(json.data.verdict, "UNMATCHED"); // paisa aaya, par koi live session nahi

  // Same SMS dobara → dedupe (content hash se messageId banta hai)
  const again = await fetch(`${baseUrl}/api/v1/observers/observations`, {
    method: "POST",
    headers: { "content-type": "text/plain", "x-observer-token": OBSERVER_SECRET },
    body: sms,
  });
  const againJson = (await again.json()) as { data: { verdict: string } };
  assert.equal(againJson.data.verdict, "DUPLICATE");
});
