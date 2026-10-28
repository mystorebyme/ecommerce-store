// Purpose: checkout: ₹1 test flow + ek-call order/QR tests
//
// Do rules jo paisa safe rakhte hain: amount server se, idempotency replay par
// naya QR nahi, aur ₹1 (100 paise) jaisa chhota amount bhi valid hai.

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createMemoryDb, TEST_MERCHANT, type MemoryDb } from "../../../../../tests/fixtures/memory-db";
import { createApp } from "../../app";
import { TEST_PRODUCT, ensureTestProduct } from "../products/products.bootstrap";

let db: MemoryDb;

beforeEach(async () => {
  db = createMemoryDb({ now: () => new Date("2026-10-28T09:00:00.000Z") });
  await db.upsertMerchant({
    name: TEST_MERCHANT.name,
    vpa: TEST_MERCHANT.vpa,
    payeeName: TEST_MERCHANT.payeeName,
    payWindowSeconds: 300,
    verifyWindowSeconds: 30,
  });
});

function http() {
  const { app } = createApp({ db, observerSecret: "secret", adminToken: "admin", webOrigin: "http://localhost:3001" });
  return app;
}

/** Express app ko sunne ke bina hi call karna — chhota supertest-replacement. */
async function post(path: string, body: unknown, headers: Record<string, string>) {
  const app = http();
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    return { status: response.status, json: (await response.json()) as any };
  } finally {
    server.close();
  }
}

test("bootstrap: ₹1 test product idempotent hai aur price kabhi overwrite nahi karta", async () => {
  await ensureTestProduct(db);
  await ensureTestProduct(db);

  const products = await db.listProducts(10);
  const testProducts = products.filter((product) => product.sku === TEST_PRODUCT.sku);
  assert.equal(testProducts.length, 1);
  assert.equal(testProducts[0]!.pricePaise, 100);
  assert.equal(testProducts[0]!.stock, 999);

  // Stock bik gaya to bootstrap use reset nahi karta.
  await db.decrementStock(TEST_PRODUCT.id, 1);
  await ensureTestProduct(db);
  const after = await db.findProductById(TEST_PRODUCT.id);
  assert.equal(after?.stock, 998);
});

test("₹1 ka order: ek call me order + UPI QR, amount 100 paise", async () => {
  await ensureTestProduct(db);

  const { status, json } = await post(
    "/api/v1/checkout",
    { customerName: "Test Buyer", customerPhone: "9876543210", items: [{ productId: TEST_PRODUCT.id, qty: 1 }] },
    { "idempotency-key": "test-rupee-1-key" },
  );

  assert.equal(status, 201);
  assert.equal(json.data.order.amountPaise, 100);
  assert.equal(json.data.payment.amountPaise, 100);
  assert.equal(json.data.payment.status, "ACTIVE");
  assert.match(json.data.payment.upi.string, /^upi:\/\/pay\?/);
  assert.match(json.data.payment.upi.string, /am=1\.00/);
  assert.equal(json.data.payment.vpa, TEST_MERCHANT.vpa);
});

test("wahi Idempotency-Key: naya order/QR nahi, wahi session wapas", async () => {
  await ensureTestProduct(db);
  const body = { customerName: "Test Buyer", customerPhone: "9876543210", items: [{ productId: TEST_PRODUCT.id, qty: 1 }] };
  const headers = { "idempotency-key": "test-replay-key" };

  const first = await post("/api/v1/checkout", body, headers);
  const second = await post("/api/v1/checkout", body, headers);

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(second.json.meta.replayed, true);
  assert.equal(second.json.data.order.id, first.json.data.order.id);
  assert.equal(second.json.data.payment.sessionId, first.json.data.payment.sessionId);
});
