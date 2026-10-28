// Purpose: gateway tests — single-slot FIFO queue, dual timers, stock release

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createMemoryDb, TEST_MERCHANT, type MemoryDb } from "../../../../../tests/fixtures/memory-db";
import { createGatewayService, type GatewayService } from "./gateway.service";

let db: MemoryDb;
let merchantId: string;
let clock: Date;

function service(overrides: Partial<Parameters<typeof createGatewayService>[0]> = {}): GatewayService {
  return createGatewayService({ db, now: () => clock, ...overrides });
}

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
  const merchant = await db.upsertMerchant({
    name: TEST_MERCHANT.name,
    vpa: TEST_MERCHANT.vpa,
    payeeName: TEST_MERCHANT.payeeName,
    webhookUrl: TEST_MERCHANT.webhookUrl,
    webhookSecret: TEST_MERCHANT.webhookSecret,
    payWindowSeconds: 300,
    verifyWindowSeconds: 30,
  });
  merchantId = merchant.id;
});

test("pehla session ACTIVE, UPI string merchant ke apne VPA par", async () => {
  const orderId = await makeOrder(189900, "o1");
  const view = await service().startForOrder({ orderId });

  assert.equal(view.status, "ACTIVE");
  assert.equal(view.queuePosition, 1);
  assert.equal(view.secondsLeftToPay, 300);
  assert.match(view.upi.string, /^upi:\/\/pay\?pa=demostore@okhdfcbank/);
  assert.match(view.upi.string, /am=1899\.00/);
  assert.match(view.upi.string, /cu=INR/);
  assert.match(view.upi.string, new RegExp(`tn=${view.reference}`));
  assert.match(view.upi.svg ?? "", /<svg/);
  assert.match(view.upi.dataUrl ?? "", /^data:image\/svg\+xml;base64,/);
});

test("dusra session QUEUED rehta hai (ek VPA, ek slot)", async () => {
  const first = await service().startForOrder({ orderId: await makeOrder(50000, "o1") });
  const second = await service().startForOrder({ orderId: await makeOrder(70000, "o2") });

  assert.equal(first.status, "ACTIVE");
  assert.equal(second.status, "QUEUED");
  // position 2 = ek buyer (ACTIVE) aage hai
  assert.equal(second.queuePosition, 2);
  assert.equal(second.aheadInQueue, 1);
  assert.equal(second.upi.svg, null, "queued buyer ko QR nahi dikhta");
});

test("same order par dobara start → wahi session (idempotent)", async () => {
  const orderId = await makeOrder(189900, "o1");
  const first = await service().startForOrder({ orderId });
  const second = await service().startForOrder({ orderId });
  assert.equal(second.sessionId, first.sessionId);
});

test("5 min ke baad pay window expire → EXPIRED, stock wapas, agla promote", async () => {
  const firstOrder = await makeOrder(50000, "o1");
  const secondOrder = await makeOrder(70000, "o2");
  const gateway = service();
  const first = await gateway.startForOrder({ orderId: firstOrder });
  const second = await gateway.startForOrder({ orderId: secondOrder });

  // Stock reserve hua tha (5 → 4)
  assert.equal((await db.findProductsByIds(["p-o1"]))[0]!.stock, 4);

  clock = new Date("2026-10-28T09:05:01.000Z");
  const result = await gateway.runTimers();

  assert.equal(result.expired, 1);
  assert.equal((await gateway.getView(first.sessionId)).status, "EXPIRED");
  assert.equal(db.getOrder(firstOrder)!.status, "EXPIRED");
  assert.equal((await db.findProductsByIds([`p-o1`]))[0]!.stock, 5, "stock release ho gaya");

  const promoted = await gateway.getView(second.sessionId);
  assert.equal(promoted.status, "ACTIVE");
  assert.equal(promoted.secondsLeftToPay, 300, "promotion par naya 5 min window");
});

test("cancel karne par slot agle ko milta hai", async () => {
  const gateway = service();
  const first = await gateway.startForOrder({ orderId: await makeOrder(50000, "o1") });
  const second = await gateway.startForOrder({ orderId: await makeOrder(70000, "o2") });

  await gateway.cancel(first.sessionId);
  assert.equal((await gateway.getView(first.sessionId)).status, "CANCELLED");
  assert.equal((await gateway.getView(second.sessionId)).status, "ACTIVE");
});

test("settle → SUCCESS + order PAID + onSettled callback ek baar", async () => {
  const settled: string[] = [];
  const gateway = service({ onSettled: (input) => { settled.push(input.utr); } });
  const view = await gateway.startForOrder({ orderId: await makeOrder(189900, "o1") });

  await gateway.settle({ sessionId: view.sessionId, utr: "412345678901", senderVpa: "aarav@oksbi" });
  await gateway.settle({ sessionId: view.sessionId, utr: "412345678901", senderVpa: "aarav@oksbi" });

  const after = await gateway.getView(view.sessionId);
  assert.equal(after.status, "SUCCESS");
  assert.equal(after.utr, "412345678901");
  assert.equal(settled.length, 1, "dobara settle se callback dobara nahi chalta");
});

test("PROCESSING ka 30s verify window nikal jaye to SUSPICIOUS", async () => {
  const gateway = service();
  const view = await gateway.startForOrder({ orderId: await makeOrder(189900, "o1") });
  const merchant = (await db.getMerchant())!;
  await gateway.markProcessing(view.sessionId, merchant);

  clock = new Date("2026-10-28T09:00:31.000Z");
  const result = await gateway.runTimers();

  assert.equal(result.suspicious, 1);
  assert.equal((await gateway.getView(view.sessionId)).status, "SUSPICIOUS");
});

test("merchant configured nahi hai to 503", async () => {
  const emptyDb = createMemoryDb({ now: () => clock });
  const gateway = createGatewayService({ db: emptyDb, now: () => clock });
  await assert.rejects(
    () => gateway.startForOrder({ orderId: "nope" }),
    (error: unknown) => (error as { code?: string }).code === "MERCHANT_NOT_CONFIGURED",
  );
  void merchantId;
});
