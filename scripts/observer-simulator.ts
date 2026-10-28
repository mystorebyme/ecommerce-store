// Purpose: Dev helper — bank observer simulator (asli observer app ki jagah)
//
// Asli setup me Android app bank ka SMS padh kar POST karta hai. Jab tak wo app
// ready na ho, ye script se poora flow test kar sakte ho:
//
//   1. `.env` me OBSERVER_SHARED_SECRET / ADMIN_API_TOKEN / DATABASE_URL set karo
//   2. API chalao:            npm run api:dev
//   3. Health check:          npx tsx scripts/observer-simulator.ts health
//   4. Manual credit bhejo:   npx tsx scripts/observer-simulator.ts pay <sessionId>
//   5. Poora demo (order → QR → credit → webhook):
//                             npx tsx scripts/observer-simulator.ts flow
//
// Signature asli HMAC-SHA256 hai (sha256=<hex>), bilkul jo Android app bhejega.

import "dotenv/config";
import { createHmac } from "node:crypto";

const API_URL = process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
const OBSERVER_SECRET = process.env.OBSERVER_SHARED_SECRET ?? "";
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN ?? "";
const AMOUNT_PAISE = Number(process.env.SIM_AMOUNT_PAISE ?? 189900);

function sign(rawBody: string): string {
  return `sha256=${createHmac("sha256", OBSERVER_SECRET).update(rawBody, "utf8").digest("hex")}`;
}

function utr(): string {
  // 12-digit numeric UTR (real bank reference jaisa)
  return String(Math.floor(400000000000 + Math.random() * 599999999999));
}

async function postJson(path: string, body: unknown, headers: Record<string, string> = {}) {
  const raw = JSON.stringify(body);
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: raw,
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null, raw };
}

async function getJson(path: string) {
  const response = await fetch(`${API_URL}${path}`);
  return { status: response.status, json: await response.json() };
}

async function health(): Promise<void> {
  const { status, json } = await getJson("/api/v1/health");
  console.log(`\nGET /api/v1/health → ${status}`);
  console.log(JSON.stringify(json, null, 2));
}

async function paySession(sessionId: string, amountPaise?: number): Promise<void> {
  const reference = utr();
  const rawText = `Rs.${((amountPaise ?? AMOUNT_PAISE) / 100).toFixed(2)} credited to your a/c XX4412 from AARAV SHARMA. UPI ref ${reference}.`;
  const body = {
    source: "ANDROID_SMS",
    deviceId: "simulator-device-1",
    messageId: `sim-${Date.now()}`,
    rawText,
  };
  const raw = JSON.stringify(body);
  const result = await postJson("/api/v1/observers/observations", body, { "x-observer-signature": sign(raw) });

  console.log(`\nPOST /api/v1/observers/observations → ${result.status}`);
  console.log(JSON.stringify(result.json, null, 2));

  const { json } = await getJson(`/api/v1/payments/${sessionId}`);
  console.log(`\nGET /api/v1/payments/${sessionId} → ${JSON.stringify(json.data?.status)} (UTR ${json.data?.utr})`);
}

async function flow(): Promise<void> {
  // 1. Order (server price decide karta hai)
  const orderRes = await postJson("/api/v1/orders", {
    customerName: "Aarav Sharma",
    customerPhone: "9876543210",
    items: [{ productId: process.env.SIM_PRODUCT_ID ?? "", qty: 1 }],
  }, { "idempotency-key": `sim-order-${Date.now()}` });

  if (orderRes.status >= 400) {
    console.error("Order create fail:", JSON.stringify(orderRes.json, null, 2));
    console.error("Tip: pehle `npx tsx database/seeds/seed.ts` chalao aur SIM_PRODUCT_ID set karo.");
    return;
  }
  const order = orderRes.json.data;
  console.log(`\n1. Order ${order.number} — ₹${(order.amountPaise / 100).toFixed(2)} (status ${order.status})`);

  // 2. Session + UPI QR
  const sessionRes = await postJson("/api/v1/payments", { orderId: order.id });
  if (sessionRes.status >= 400) {
    console.error("Payment start fail:", JSON.stringify(sessionRes.json, null, 2));
    return;
  }
  const session = sessionRes.json.data;
  console.log(`2. Session ${session.sessionId} — ${session.status} (queue ${session.queuePosition})`);
  console.log(`   UPI: ${session.upi.string}`);
  console.log(`   QR data URL: ${String(session.upi.dataUrl).slice(0, 64)}…  (browser me <img src> me daalo)`);
  console.log(`   Timer: ${session.secondsLeftToPay}s to pay`);

  // 3. Bank observer credit (yahi asli app karega)
  await paySession(session.sessionId, order.amountPaise);

  // 4. Webhook deliveries (merchant side proof)
  console.log("\n4. Merchant webhook deliveries DB me record hoti hain → GET /api/v1/health ke baad");
  console.log("   Apne server par X-Youpi-Signature verify karo (docs/06-api/webhooks.md).");
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "health";
  const arg = process.argv[3];

  const known = ["health", "pay", "flow", "admin"];
  if (!known.includes(command)) {
    console.log("Commands: health | pay <sessionId> [amountPaise] | flow | admin");
    return;
  }
  if (!OBSERVER_SECRET && command !== "health") {
    console.error("OBSERVER_SHARED_SECRET missing — .env me set karo (kam se kam 16 chars).");
    process.exit(1);
  }

  switch (command) {
    case "health":
      await health();
      break;
    case "pay":
      if (!arg) {
        console.error("Usage: npx tsx scripts/observer-simulator.ts pay <sessionId> [amountPaise]");
        process.exit(1);
      }
      await paySession(arg, process.argv[4] ? Number(process.argv[4]) : undefined);
      break;
    case "flow":
      await flow();
      break;
    case "admin":
      console.log(`\nMerchant config (x-admin-token): ${ADMIN_TOKEN ? "set" : "missing"}`);
      console.log(
        JSON.stringify(
          (await (await fetch(`${API_URL}/api/v1/admin/merchant`, {
            headers: { "x-admin-token": ADMIN_TOKEN },
          })).json()),
          null,
          2,
        ),
      );
      break;
    default:
      console.log("Commands: health | pay <sessionId> [amountPaise] | flow | admin");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
