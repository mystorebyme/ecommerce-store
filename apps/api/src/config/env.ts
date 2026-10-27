// Purpose: Environment variables validation
//
// Rule: secrets sirf `.env` me. Missing key par server saaf error deta hai,
// undefined ke saath silently chalta nahi.

import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  PUBLIC_WEB_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).optional(),
  RAZORPAY_KEY_ID: z.string().trim().optional(),
  RAZORPAY_KEY_SECRET: z.string().trim().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().trim().optional(),
  PAYMENT_TTL_SECONDS: z.coerce.number().int().min(60).max(1800).default(300),
  PAYMENTS_DRY_RUN: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .default(false)
    .transform((v) => v === true || v === "true"),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration → ${details}`);
  }
  return parsed.data;
}

/** Payment provider ke liye zaroori keys check — route 503 deta hai agar missing hon. */
export function assertRazorpayConfigured(config: AppConfig): void {
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
    throw new Error(
      "Razorpay keys missing. apps/api/.env me RAZORPAY_KEY_ID aur RAZORPAY_KEY_SECRET daalo " +
        "(test mode ke liye rzp_test_... keys Dashboard → API Keys se milti hain).",
    );
  }
}

export function assertWebhookConfigured(config: AppConfig): void {
  if (!config.RAZORPAY_WEBHOOK_SECRET) {
    throw new Error(
      "RAZORPAY_WEBHOOK_SECRET missing. Dashboard → Webhooks → secret (ye key secret NAHI hai).",
    );
  }
}
