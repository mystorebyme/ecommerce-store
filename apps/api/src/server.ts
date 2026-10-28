// Purpose: Server start (port listen) + graceful shutdown
//
// Wiring: env → config → prisma db → merchant (env se seed) → gateway → app.
// Do timers chalte hain (5s tick):
//   * gateway.runTimers()        → pay window expire + FIFO promotion + verify timeout
//   * merchantWebhooks.processDue() → webhook retries (backoff)

import "dotenv/config";
import { createApp } from "./app";
import { createPrismaDb } from "./config/db";
import { configWarnings, loadConfig } from "./config/env";

async function main(): Promise<void> {
  const config = loadConfig();
  const warnings = configWarnings(config);
  for (const warning of warnings) {
    console.warn(JSON.stringify({ level: "warn", msg: "config", detail: warning }));
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing — `docker compose up -d postgres` chalao, phir .env check karo.");
    process.exit(1);
  }

  const db = createPrismaDb();

  // Merchant env se seed/update — pehli baar chalane par admin API ki zarurat nahi.
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

  const { app, gateway, merchantWebhooks } = createApp({
    db,
    observerSecret: config.OBSERVER_SHARED_SECRET ?? "",
    adminToken: config.ADMIN_API_TOKEN ?? "",
    webOrigin: config.PUBLIC_WEB_URL,
    onSettled: (input) => {
      // Production me yahan BullMQ jobs: invoice, email, WhatsApp, Shiprocket.
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

  const server = app.listen(config.PORT, () => {
    console.log(
      JSON.stringify({
        level: "info",
        msg: "api_started",
        port: config.PORT,
        gateway: "youpi-selfhosted",
        merchantVpa: config.MERCHANT_VPA ?? null,
        observersEnabled: Boolean(config.OBSERVER_SHARED_SECRET),
      }),
    );
  });

  const timer = setInterval(() => {
    gateway
      .runTimers()
      .then(async (result) => {
        if (result.expired || result.suspicious) {
          console.log(JSON.stringify({ level: "info", msg: "timers", ...result }));
        }
        await merchantWebhooks.processDue();
      })
      .catch((error: unknown) => {
        console.error(JSON.stringify({ level: "error", msg: "timer_tick_failed", error: String(error) }));
      });
  }, 5_000);
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

main().catch((error) => {
  console.error(JSON.stringify({ level: "error", msg: "boot_failed", error: String(error) }));
  process.exit(1);
});
