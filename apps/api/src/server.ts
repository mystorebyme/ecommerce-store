// Purpose: Server start (port listen) + graceful shutdown
//
// Yahan sab wiring hoti hai: env → config → prisma db → razorpay provider → app.
// Keys missing ho to server saaf message ke saath band hota hai (adhoora start nahi).

import "dotenv/config";
import { createApp } from "./app";
import { createPrismaDb } from "./config/db";
import { assertRazorpayConfigured, loadConfig } from "./config/env";
import type { createPaymentsService } from "./modules/payments/payments.service";
import { createRazorpayProvider } from "./modules/payments/providers/razorpay.provider";

function main(): void {
  const config = loadConfig();
  assertRazorpayConfigured(config);

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing — docker compose up -d postgres, phir .env check karo.");
    process.exit(1);
  }

  const db = createPrismaDb();
  const provider = createRazorpayProvider({
    keyId: config.RAZORPAY_KEY_ID!,
    keySecret: config.RAZORPAY_KEY_SECRET!,
    webhookSecret: config.RAZORPAY_WEBHOOK_SECRET ?? "",
  });

  const app = createApp({
    db,
    provider,
    paymentsConfig: {
      providerKeyId: config.RAZORPAY_KEY_ID!,
      providerName: provider.name,
      ttlSeconds: config.PAYMENT_TTL_SECONDS,
      webBaseUrl: config.PUBLIC_WEB_URL,
    },
    webOrigin: config.PUBLIC_WEB_URL,
    onPaid: (paymentId) => {
      // Production me: emailQueue.add("payment-received", ...) + invoiceQueue.add(...)
      console.log(JSON.stringify({ level: "info", msg: "payment_paid", paymentId }));
    },
  });

  const server = app.listen(config.PORT, () => {
    console.log(
      JSON.stringify({
        level: "info",
        msg: "api_started",
        port: config.PORT,
        provider: provider.name,
        ttlSeconds: config.PAYMENT_TTL_SECONDS,
      }),
    );
  });

  // Expiry scheduler — 60s me ek baar. Production me BullMQ repeatable job
  // (`expire-qr.scheduler.ts`) se chalega, par logic wahi `expireStale()` hai.
  const payments = (app.locals as { payments: ReturnType<typeof createPaymentsService> }).payments;
  const timer = setInterval(() => {
    payments.expireStale().catch((error: unknown) => {
      console.error(JSON.stringify({ level: "error", msg: "expire_stale_failed", error: String(error) }));
    });
  }, 60_000);
  timer.unref();

  const shutdown = (signal: string): void => {
    console.log(JSON.stringify({ level: "info", msg: "shutdown", signal }));
    clearInterval(timer);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
