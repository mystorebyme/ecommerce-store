// Purpose: Seed script entry
//
// Local DB me minimum data:
//   * merchant (aapka UPI VPA) — .env ke MERCHANT_VPA se
//   * 3 products (integer paise)
//
//   npm run prisma:generate
//   npx tsx database/seeds/seed.ts
//
// VPA na ho to script ruk jaata hai — kyunki gateway ke bina QR nahi ban sakta.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  { sku: "KURTA-01", name: "Handblock Cotton Kurta", pricePaise: 189900, stock: 25 },
  { sku: "TOTE-01", name: "Canvas Tote — Indigo", pricePaise: 129900, stock: 40 },
  { sku: "DUPATTA-01", name: "Chanderi Dupatta", pricePaise: 74900, stock: 15 },
] as const;

async function main(): Promise<void> {
  const vpa = process.env.MERCHANT_VPA;
  if (!vpa) {
    console.error("MERCHANT_VPA missing — .env me apna UPI VPA daalo (e.g. yourstore@okhdfcbank).");
    process.exit(1);
  }

  const merchant = await prisma.merchantAccount.upsert({
    where: { vpa },
    update: {
      name: process.env.MERCHANT_NAME ?? "Demo Store",
      payeeName: process.env.PAYEE_NAME ?? process.env.MERCHANT_NAME ?? "Demo Store",
      webhookUrl: process.env.MERCHANT_WEBHOOK_URL ?? null,
      webhookSecret: process.env.MERCHANT_WEBHOOK_SECRET ?? null,
      payWindowSeconds: Number(process.env.PAY_WINDOW_SECONDS ?? 300),
      verifyWindowSeconds: Number(process.env.VERIFY_WINDOW_SECONDS ?? 30),
    },
    create: {
      name: process.env.MERCHANT_NAME ?? "Demo Store",
      vpa,
      payeeName: process.env.PAYEE_NAME ?? process.env.MERCHANT_NAME ?? "Demo Store",
      webhookUrl: process.env.MERCHANT_WEBHOOK_URL ?? null,
      webhookSecret: process.env.MERCHANT_WEBHOOK_SECRET ?? null,
      payWindowSeconds: Number(process.env.PAY_WINDOW_SECONDS ?? 300),
      verifyWindowSeconds: Number(process.env.VERIFY_WINDOW_SECONDS ?? 30),
    },
  });
  console.log(`✓ Merchant ${merchant.name} (${merchant.vpa})`);

  for (const product of products) {
    const row = await prisma.product.upsert({
      where: { sku: product.sku },
      update: { pricePaise: product.pricePaise, stock: product.stock, active: true },
      create: { ...product, active: true },
    });
    console.log(`✓ ${row.sku} — ₹${(row.pricePaise / 100).toFixed(2)} (stock ${row.stock})`);
  }
  console.log(`\nSeed done: 1 merchant + ${products.length} products.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
