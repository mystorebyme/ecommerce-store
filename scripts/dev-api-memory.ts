#!/usr/bin/env tsx
// Purpose: API ko in-memory DB ke saath chalao — sirf UI/storefront develop karne ke liye
//
// ⚠️ Ye REAL MONEY ke liye nahi hai: koi persistence nahi (restart = sab zero), aur
//    `database/prisma` use nahi hota. Asli orders ke liye `npm run api:dev` (Postgres).
//
// Use:
//   npx tsx scripts/dev-api-memory.ts            # http://localhost:4000
//   PORT=4100 OBSERVER_SHARED_SECRET=devsecret npx tsx scripts/dev-api-memory.ts
//
// Storefront (`apps/web`) isi par chalta hai — products seed ho jaate hain.

import { createApp } from "../apps/api/src/app";
import { createMemoryDb } from "../tests/fixtures/memory-db";
import { TEST_PRODUCT } from "../apps/api/src/modules/products/products.bootstrap";

async function main() {
  const port = Number(process.env.PORT ?? 4000);
  const observerSecret = process.env.OBSERVER_SHARED_SECRET ?? "dev_observer_secret_change_me";
  const adminToken = process.env.ADMIN_API_TOKEN ?? "dev_admin_token_change_me";

  const db = createMemoryDb();

  await db.upsertMerchant({
    name: process.env.MERCHANT_NAME ?? "YouPI Store",
    vpa: process.env.MERCHANT_VPA ?? "demostore@okhdfcbank",
    payeeName: process.env.PAYEE_NAME ?? "YouPI Store",
    webhookUrl: null,
    webhookSecret: null,
    payWindowSeconds: 300,
    verifyWindowSeconds: 30,
  });

  const seedProducts = [
    { id: "prod_kurta", sku: "KUR-001", name: "Handloom Cotton Kurta", pricePaise: 189900, stock: 6 },
    { id: "prod_shirt", sku: "SHT-002", name: "Linen Oversized Shirt", pricePaise: 149900, stock: 4 },
    { id: "prod_coord", sku: "CRD-003", name: "Block-Print Co-ord Set", pricePaise: 279900, stock: 3 },
    { id: "prod_dupatta", sku: "DUP-004", name: "Chanderi Dupatta", pricePaise: 89900, stock: 0 },
    { id: TEST_PRODUCT.id, sku: TEST_PRODUCT.sku, name: TEST_PRODUCT.name, pricePaise: TEST_PRODUCT.pricePaise, stock: TEST_PRODUCT.stock },
  ];
  for (const product of seedProducts) db.seedProduct(product);

  const { app } = createApp({
    db,
    observerSecret,
    adminToken,
    webOrigin: process.env.PUBLIC_WEB_URL ?? "http://localhost:3001",
  });

  const merchant = await db.getMerchant();

  app.listen(port, "0.0.0.0", () => {
    console.log(`\n  YouPI API (in-memory dev) → http://localhost:${port}/api/v1`);
    console.log(`  Merchant VPA : ${merchant?.vpa ?? "-"}`);
    console.log(`  Products     : ${seedProducts.length} seeded`);
    console.log(`  Observer HMAC: ${observerSecret}`);
    console.log(`  Admin token  : ${adminToken}\n`);
    console.log("  ⚠️  In-memory: restart par sab data chala jaayega. Real orders ke liye Postgres use karo.\n");
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
