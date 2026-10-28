// Purpose: payment links — fixed amount lock, open limits, expiry, max uses, audit

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createMemoryDb, TEST_MERCHANT, type MemoryDb } from "../../../../../tests/fixtures/memory-db";
import { createApp } from "../../app";

const ADMIN = "test-admin-token";
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

function build() {
  return createApp({ db, observerSecret: "observer-secret", adminToken: ADMIN, webOrigin: "http://localhost:3001" });
}

async function call(
  app: ReturnType<typeof build>["app"],
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  headers: Record<string, string> = { "x-admin-token": ADMIN },
) {
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, json: (await response.json()) as any };
  } finally {
    server.close();
  }
}

const buyer = { customerName: "Aarav", customerPhone: "9876543210" };

test("fixed link: amount DB se lock hai, request ka amount ignore hota hai", async () => {
  const { app } = build();
  const created = await call(app, "POST", "/api/v1/admin/links", {
    kind: "FIXED",
    title: "Advance booking",
    amountPaise: 50000,
  });
  assert.equal(created.status, 201);
  const token = created.json.data.token;
  assert.match(created.json.data.path, /^\/pay\//);

  const view = await call(app, "GET", `/api/v1/pay/links/${token}`, undefined, {});
  assert.equal(view.json.data.amountPaise, 50000);

  // Buyer ₹1 bhejne ki koshish kare — server DB ka ₹500 hi use karta hai.
  const pay = await call(app, "POST", `/api/v1/pay/links/${token}`, { ...buyer, amountPaise: 100 }, {});
  assert.equal(pay.status, 201);
  assert.equal(pay.json.data.amountPaise, 50000);
  assert.equal(pay.json.data.payment.amountPaise, 50000);
  assert.match(pay.json.data.payment.upi.string, /am=500\.00/);
});

test("open link: min/max ke andar amount chalta hai, bahar reject", async () => {
  const { app } = build();
  // Merchant ne limits set ki: ₹5 se ₹1000
  await call(app, "POST", "/api/v1/admin/settings/limits", { minAmountPaise: 500, maxAmountPaise: 100000 });

  const created = await call(app, "POST", "/api/v1/admin/links", { kind: "OPEN", title: "Kuch bhi pay karo" });
  assert.equal(created.status, 201);
  const token = created.json.data.token;

  // ₹1 (100 paise) — schema valid hai par merchant ki min limit se neeche
  const tooSmall = await call(app, "POST", `/api/v1/pay/links/${token}`, { ...buyer, amountPaise: 100 }, {});
  assert.equal(tooSmall.status, 400);
  assert.equal(tooSmall.json.error.code, "AMOUNT_OUT_OF_RANGE");

  // ₹1,500 — max ₹1,000 se upar
  const tooBig = await call(app, "POST", `/api/v1/pay/links/${token}`, { ...buyer, amountPaise: 150000 }, {});
  assert.equal(tooBig.status, 400);
  assert.equal(tooBig.json.error.code, "AMOUNT_OUT_OF_RANGE");

  const ok = await call(app, "POST", `/api/v1/pay/links/${token}`, { ...buyer, amountPaise: 25000 }, {});
  assert.equal(ok.status, 201);
  assert.equal(ok.json.data.amountPaise, 25000);
});

test("disable ki hui link par payment nahi hota", async () => {
  const { app } = build();
  const created = await call(app, "POST", "/api/v1/admin/links", { kind: "FIXED", title: "Diwali offer", amountPaise: 9900 });
  const id = created.json.data.id;
  const token = created.json.data.token;

  await call(app, "POST", `/api/v1/admin/links/${id}/disable`, {});
  const pay = await call(app, "POST", `/api/v1/pay/links/${token}`, buyer, {});
  assert.equal(pay.status, 409);
  assert.equal(pay.json.error.code, "LINK_NOT_PAYABLE");
});

test("maxUses poori hone par link USED_UP ho jaata hai", async () => {
  const { app } = build();
  const created = await call(app, "POST", "/api/v1/admin/links", {
    kind: "FIXED",
    title: "Single use link",
    amountPaise: 100,
    maxUses: 1,
  });
  const token = created.json.data.token;

  const first = await call(app, "POST", `/api/v1/pay/links/${token}`, buyer, {});
  assert.equal(first.status, 201);

  const second = await call(app, "POST", `/api/v1/pay/links/${token}`, buyer, {});
  assert.equal(second.status, 409);

  const view = await call(app, "GET", `/api/v1/pay/links/${token}`, undefined, {});
  assert.equal(view.json.data.status, "USED_UP");
  assert.equal(view.json.data.remainingUses, 0);
});

test("expiry ke baad link EXPIRED dikhta hai", async () => {
  const { app } = build();
  const created = await call(app, "POST", "/api/v1/admin/links", {
    kind: "FIXED",
    title: "Kal tak valid",
    amountPaise: 10000,
    expiresInHours: 1,
  });
  const token = created.json.data.token;

  // 2 ghante aage le jao
  const later = createMemoryDb({ now: () => new Date("2026-10-28T12:00:00.000Z") });
  await later.upsertMerchant({
    name: TEST_MERCHANT.name,
    vpa: TEST_MERCHANT.vpa,
    payeeName: TEST_MERCHANT.payeeName,
    payWindowSeconds: 300,
    verifyWindowSeconds: 30,
  });
  await later.createPaymentLink({
    token,
    kind: "FIXED",
    title: "Kal tak valid",
    note: "Test",
    amountPaise: 10000,
    maxUses: 100,
    expiresAt: new Date("2026-10-28T10:00:00.000Z"),
    createdBy: "test",
  });

  const laterApp = createApp({ db: later, observerSecret: "s", adminToken: ADMIN, webOrigin: "http://localhost:3001", now: () => new Date("2026-10-28T12:00:00.000Z") });
  const view = await call(laterApp.app, "GET", `/api/v1/pay/links/${token}`, undefined, {});
  assert.equal(view.json.data.status, "EXPIRED");
});

test("link banane par audit entry likhi jaati hai", async () => {
  const { app } = build();
  await call(app, "POST", "/api/v1/admin/links", { kind: "FIXED", title: "Audit check", amountPaise: 19900 });
  const audit = await call(app, "GET", "/api/v1/admin/settings/audit?action=links.created");
  assert.equal(audit.status, 200);
  assert.equal(audit.json.data.length, 1);
  assert.equal(audit.json.data[0].entity, "payment_link");
});
