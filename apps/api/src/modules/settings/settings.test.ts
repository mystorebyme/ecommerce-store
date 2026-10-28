// Purpose: settings — VPA staging, ₹1 test gate, limits, audit log
//
// Core promise: naya VPA tab tak live nahi hota jab tak us par ₹1 test settle na ho.

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createMemoryDb, TEST_MERCHANT, type MemoryDb } from "../../../../../tests/fixtures/memory-db";
import { createApp } from "../../app";
import { ensureTestProduct } from "../products/products.bootstrap";

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

test("admin settings: live VPA + limits dikhte hain, token ke bina 401", async () => {
  const { app } = build();
  const unauthorized = await call(app, "GET", "/api/v1/admin/settings", undefined, {});
  assert.equal(unauthorized.status, 401);

  const ok = await call(app, "GET", "/api/v1/admin/settings");
  assert.equal(ok.status, 200);
  assert.equal(ok.json.data.merchant.vpa, TEST_MERCHANT.vpa);
  assert.equal(ok.json.data.limits.minAmountPaise, 100);
  assert.equal(ok.json.data.pendingVpa, null);
});

test("VPA change: stage karne par live VPA nahi badalta (sirf pending)", async () => {
  const { app } = build();

  const staged = await call(app, "POST", "/api/v1/admin/settings/vpa", { vpa: "newshop@okicici" });
  assert.equal(staged.status, 201);
  assert.equal(staged.json.data.pendingVpa, "newshop@okicici");
  // Live VPA wahi purana — customer ka paisa galat jagah nahi jaayega.
  assert.equal(staged.json.data.merchant.vpa, TEST_MERCHANT.vpa);

  const audit = await call(app, "GET", "/api/v1/admin/settings/audit");
  assert.equal(audit.json.data[0].action, "settings.vpa.staged");
  assert.match(audit.json.data[0].before, /demostore@okhdfcbank/);
});

test("invalid VPA format reject hota hai", async () => {
  const { app } = build();
  const bad = await call(app, "POST", "/api/v1/admin/settings/vpa", { vpa: "not-a-vpa" });
  assert.equal(bad.status, 422);
});

test("₹1 test: pending VPA par QR banta hai aur settle hone par VPA live ho jaata hai", async () => {
  const { app, settings } = build();
  await ensureTestProduct(db);
  await call(app, "POST", "/api/v1/admin/settings/vpa", { vpa: "newshop@okicici" });

  const testStart = await call(app, "POST", "/api/v1/admin/settings/vpa/test", {});
  assert.equal(testStart.status, 201);
  assert.equal(testStart.json.data.amountPaise, 100);
  assert.equal(testStart.json.data.vpa, "newshop@okicici");
  assert.match(testStart.json.data.upi.string, /pa=newshop@okicici/);

  // Live VPA tab bhi purana hi hai.
  assert.equal((await db.getMerchant())?.vpa, TEST_MERCHANT.vpa);

  // ₹1 settle (observer/manual) → promotion
  await settings.promoteIfPendingMatches("newshop@okicici", { actor: "test" });

  const merchant = await db.getMerchant();
  assert.equal(merchant?.vpa, "newshop@okicici");
  const view = await call(app, "GET", "/api/v1/admin/settings");
  assert.equal(view.json.data.pendingVpa, null);
  assert.equal(view.json.data.merchant.vpa, "newshop@okicici");
});

test("open-link limits update hote hain aur public endpoint par dikhte hain", async () => {
  const { app } = build();
  const updated = await call(app, "POST", "/api/v1/admin/settings/limits", {
    minAmountPaise: 500,
    maxAmountPaise: 100000,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.data.limits.minAmountPaise, 500);

  const publicLimits = await call(app, "GET", "/api/v1/pay/limits", undefined, {});
  assert.equal(publicLimits.status, 200);
  assert.equal(publicLimits.json.data.minAmountPaise, 500);
  assert.equal(publicLimits.json.data.maxAmountPaise, 100000);
});

test("limits me min > max reject hota hai", async () => {
  const { app } = build();
  const bad = await call(app, "POST", "/api/v1/admin/settings/limits", {
    minAmountPaise: 100000,
    maxAmountPaise: 500,
  });
  assert.equal(bad.status, 422);
});
