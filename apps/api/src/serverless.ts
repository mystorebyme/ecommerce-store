// Purpose: Vercel/serverless entry — Express app ko ek hi baar boot karke cache karta hai
//
// Serverless me har instance ke andar `app` reuse hota hai (cold start par ek baar boot).
// Timers interval se nahi chalte — `autoSweep` har request par throttled sweep karta hai,
// isliye QR expiry aur webhook retries bina long-running process ke bhi chalte hain.

import type { Express } from "express";
import { createApp } from "./app";
import { createPrismaDb, type Db } from "./config/db";
import { configWarnings, loadConfig } from "./config/env";

let appPromise: Promise<Express> | null = null;

async function boot(): Promise<Express> {
  const config = loadConfig();

  for (const warning of configWarnings(config)) {
    console.warn(JSON.stringify({ level: "warn", msg: "config", detail: warning }));
  }

  const { db, dbHost } = await connectDatabase();

  // Merchant env se upsert — VPA .env me badalne par deploy ke baad apne aap set ho jaata hai.
  if (config.MERCHANT_VPA) {
    await db.upsertMerchant({
      name: config.MERCHANT_NAME,
      vpa: config.MERCHANT_VPA,
      payeeName: config.PAYEE_NAME ?? config.MERCHANT_NAME,
      webhookUrl: config.MERCHANT_WEBHOOK_URL ?? null,
      webhookSecret: config.MERCHANT_WEBHOOK_SECRET ?? null,
      payWindowSeconds: config.PAY_WINDOW_SECONDS,
      verifyWindowSeconds: config.VERIFY_WINDOW_SECONDS,
    });
  }

  const { app } = createApp({
    db,
    observerSecret: config.OBSERVER_SHARED_SECRET ?? "",
    adminToken: config.ADMIN_API_TOKEN ?? "",
    webOrigin: config.PUBLIC_WEB_URL,
    autoSweep: { intervalMs: 5_000 },
    runtime: { dbHost, platform: "serverless" },
    onSettled: (input) => {
      console.log(
        JSON.stringify({
          level: "info",
          msg: "payment_settled",
          sessionId: input.session.id,
          orderId: input.order.id,
          amountPaise: input.session.amountPaise,
          utr: input.utr,
        }),
      );
    },
  });

  return app;
}

/**
 * DB connect — `DATABASE_URL` pehle, fail hone par `DATABASE_URL_FALLBACK`.
 *
 * Kyun: Supabase ke do pooler hosts hote hain (aws-0 / aws-1) aur project kisi
 * ek par hota hai. Galat host par "tenant not found" aata hai. Fallback se deploy
 * kabhi DB ke chakkar me nahi atakta, aur `/health` batata hai kaunsa host chala.
 */
async function connectDatabase(): Promise<{ db: Db; dbHost: string }> {
  const candidates = [process.env.DATABASE_URL, process.env.DATABASE_URL_FALLBACK].filter(
    (value): value is string => Boolean(value),
  );
  if (candidates.length === 0) throw new Error("DATABASE_URL missing");

  let lastError: unknown = null;
  for (const url of candidates) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PrismaClientCtor = require("@prisma/client").PrismaClient as new (options: unknown) => any;
    const client = new PrismaClientCtor({ datasources: { db: { url } } });
    try {
      await client.$queryRaw`SELECT 1`;
      return { db: createPrismaDb(client), dbHost: new URL(url).hostname };
    } catch (error) {
      lastError = error;
      await client.$disconnect().catch(() => undefined);
      console.warn(
        JSON.stringify({ level: "warn", msg: "db_connect_failed", host: new URL(url).hostname, error: String(error).slice(0, 160) }),
      );
    }
  }
  throw lastError ?? new Error("DATABASE_URL invalid");
}

/** Serverless handler ke liye cached Express app. */
export function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = boot().catch((error: unknown) => {
      appPromise = null; // agla request dobara try kare
      throw error;
    });
  }
  return appPromise;
}
