// Purpose: Seed script entry
//
// Local DB me minimum data: 3 products (integer paise). Iske baad API se asli
// order + Razorpay test payment chala sakte ho.
//
//   npm run prisma:generate
//   npx tsx database/seeds/seed.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  { sku: "KURTA-01", name: "Handblock Cotton Kurta", pricePaise: 189900, stock: 25 },
  { sku: "TOTE-01", name: "Canvas Tote — Indigo", pricePaise: 129900, stock: 40 },
  { sku: "DUPATTA-01", name: "Chanderi Dupatta", pricePaise: 74900, stock: 15 },
] as const;

async function main(): Promise<void> {
  for (const product of products) {
    const row = await prisma.product.upsert({
      where: { sku: product.sku },
      update: { pricePaise: product.pricePaise, stock: product.stock, active: true },
      create: { ...product, active: true },
    });
    console.log(`✓ ${row.sku} — ₹${(row.pricePaise / 100).toFixed(2)} (stock ${row.stock})`);
  }
  console.log(`\nSeed done: ${products.length} products.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
