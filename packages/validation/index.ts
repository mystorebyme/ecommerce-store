// Purpose: Schemas export
//
// Shared zod schemas — SINGLE source of truth. Frontend (web/admin) aur backend (api)
// dono yahi rules import karte hain, taaki client aur server kabhi disagree na karein.
//
// Rule: paisa integer paise me. Kabhi bhi `rupees` (float) accept nahi karte.

import { z } from "zod";

/** INR, integer paise, min ₹1 (UPI ka minimum) aur max ₹5,00,000. */
export const paiseSchema = z
  .number()
  .int("Amount integer paise me hona chahiye")
  .min(100, "Minimum ₹1.00")
  .max(50_000_000, "Maximum ₹5,00,000");

/** Indian mobile: +91 optional, 10 digit, 6-9 se start. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .transform((v) => (v.startsWith("+91") ? v.slice(3) : v.startsWith("91") && v.length === 12 ? v.slice(2) : v))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Valid 10-digit Indian mobile number daalein"));

export const skuSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[A-Z0-9][A-Z0-9_-]*$/i, "SKU me sirf letters, digits, - aur _ allowed");

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

export const orderItemInputSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().min(1).max(10, "Ek item max 10 qty"),
});

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(2).max(80),
  customerPhone: phoneSchema,
  items: z.array(orderItemInputSchema).min(1, "Kam se kam ek item chahiye").max(20),
});

// ---------------------------------------------------------------------------
// Payment session (self-hosted UPI gateway)
// ---------------------------------------------------------------------------

export const startPaymentSchema = z.object({
  orderId: z.string().min(1),
});

/** UPI VPA: `name@bank` (e.g. store@okhdfcbank) */
export const vpaSchema = z
  .string()
  .trim()
  .min(5)
  .max(100)
  .regex(/^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}$/, "VPA format: name@bank");

/** Merchant (apna bank account) configuration — admin token ke saath. */
export const merchantConfigSchema = z.object({
  name: z.string().trim().min(2).max(80),
  vpa: vpaSchema,
  payeeName: z.string().trim().min(2).max(60),
  webhookUrl: z.string().url().optional(),
  webhookSecret: z.string().min(16, "Webhook secret kam se kam 16 chars").max(128).optional(),
  payWindowSeconds: z.number().int().min(60).max(1800).optional(),
  verifyWindowSeconds: z.number().int().min(10).max(300).optional(),
});

/**
 * Bank observer ka payload. Observer raw SMS text bhej sakta hai (server parse karega)
 * ya already-parsed amount + UTR.
 */
export const observationSchema = z
  .object({
    source: z.enum(["ANDROID_SMS", "GMAIL", "MESSAGES", "MANUAL"]),
    deviceId: z.string().trim().min(3).max(80),
    messageId: z.string().trim().min(3).max(120),
    rawText: z.string().trim().min(10).max(1000).optional(),
    amountPaise: paiseSchema.optional(),
    utr: z
      .string()
      .trim()
      .regex(/^[0-9]{9,18}$/, "UTR 9-18 digits")
      .optional(),
    senderVpa: vpaSchema.optional(),
    bankName: z.string().trim().max(40).optional(),
    observedAt: z.coerce.date().optional(),
  })
  .refine((value) => Boolean(value.rawText) || (Boolean(value.amountPaise) && Boolean(value.utr)), {
    message: "rawText ya (amountPaise + utr) me se kuch ek zaroori hai",
    path: ["rawText"],
  });

/**
 * Admin manual confirm — jab bank app me paisa dikhe par observer ne SMS/email na bheja ho.
 * UTR zaroori hai (reconciliation ke liye); amount optional (mismatch par server reject karega).
 */
export const manualConfirmSchema = z.object({
  utr: z
    .string()
    .trim()
    .regex(/^[0-9]{9,18}$/, "UTR / RRN 9-18 digits ka hota hai (bank app → transaction details)"),
  amountPaise: paiseSchema.optional(),
  senderVpa: vpaSchema.optional(),
  note: z.string().trim().max(200).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type StartPaymentInput = z.infer<typeof startPaymentSchema>;
export type MerchantConfigInput = z.infer<typeof merchantConfigSchema>;
export type ObservationInput = z.infer<typeof observationSchema>;
export type ManualConfirmInput = z.infer<typeof manualConfirmSchema>;
