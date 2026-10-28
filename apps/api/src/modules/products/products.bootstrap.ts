// Purpose: catalog bootstrap — ₹1 test product ko idempotent tarike se ensure karta hai
//
// Kyun: live DB par pehli baar deploy karte waqt catalog khaali hota hai, aur
// "₹1 ka test payment" karne ke liye ek product chahiye. Serverless par koi
// shell nahi hota, isliye ye kaam app boot par ek baar (per instance) hota hai.
//
// Rules:
//   * Sirf CREATE — agar SKU pehle se hai to price/stock ko chhua bhi nahi jaata
//     (merchant ka data kabhi overwrite nahi hota).
//   * Blocking nahi — boot par fire-and-forget, request ki latency par asar zero.
//   * `CATALOG_BOOTSTRAP=off` se poori tarah band.

import type { Db } from "../../config/db";

/** ₹1 ka test item — UPI QR se asli ₹1 bhej kar flow end-to-end test karne ke liye. */
export const TEST_PRODUCT = {
  id: "prod_test1",
  sku: "TEST-001",
  name: "₹1 Test Item — UPI Test",
  /** Integer paise: ₹1.00 */
  pricePaise: 100,
  stock: 999,
} as const;

export function catalogBootstrapEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.CATALOG_BOOTSTRAP ?? "on").toLowerCase() !== "off";
}

/**
 * Ek hi baar DB tak jaata hai; dobara call karne par kuch nahi hota.
 * Kabhi throw nahi karta — boot kabhi fail nahi hona chahiye.
 */
export async function ensureTestProduct(db: Db): Promise<void> {
  try {
    await db.upsertProductBySku({ ...TEST_PRODUCT });
  } catch {
    /* bootstrap best-effort hai — catalog baaki products se chalta rahega */
  }
}
