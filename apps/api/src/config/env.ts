// Purpose: Environment variables validation
//
// Rule: secrets sirf `.env` me. Missing config par server saaf error deta hai,
// `undefined` ke saath silently chalta nahi.

import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  PUBLIC_WEB_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).optional(),

  // --- Gateway (self-hosted UPI) -------------------------------------------
  /** Merchant (aapka) UPI VPA — paisa seedha yahan aayega. */
  MERCHANT_VPA: z.string().trim().optional(),
  MERCHANT_NAME: z.string().trim().default("Demo Store"),
  PAYEE_NAME: z.string().trim().optional(),
  /** Aapke server ka webhook URL (jahan signed delivery jaayegi). */
  MERCHANT_WEBHOOK_URL: z.string().url().optional(),
  MERCHANT_WEBHOOK_SECRET: z.string().min(16).optional(),
  /** Observers (Android app) ka shared secret. */
  OBSERVER_SHARED_SECRET: z.string().min(16).optional(),
  /** Admin endpoints ka token (merchant config). */
  ADMIN_API_TOKEN: z.string().min(16).optional(),

  PAY_WINDOW_SECONDS: z.coerce.number().int().min(60).max(1800).default(300),
  VERIFY_WINDOW_SECONDS: z.coerce.number().int().min(10).max(300).default(30),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment configuration → ${details}`);
  }
  return parsed.data;
}

/** Server start par kya-kya missing hai — warning list (hard fail nahi, taaki dev shuru kar sake). */
export function configWarnings(config: AppConfig): string[] {
  const warnings: string[] = [];
  if (!config.DATABASE_URL) warnings.push("DATABASE_URL missing — DB se kuch nahi chalega.");
  if (!config.MERCHANT_VPA) {
    warnings.push("MERCHANT_VPA missing — POST /api/v1/admin/merchant se VPA set karo (warna sessions 503).");
  }
  if (!config.OBSERVER_SHARED_SECRET) {
    warnings.push("OBSERVER_SHARED_SECRET missing — observer ingest 503 dega (isse pehle payments confirm nahi honge).");
  }
  if (!config.MERCHANT_WEBHOOK_URL || !config.MERCHANT_WEBHOOK_SECRET) {
    warnings.push("Merchant webhook URL/secret missing — merchant ko signed delivery nahi jaayegi.");
  }
  return warnings;
}
