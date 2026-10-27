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
// Payment
// ---------------------------------------------------------------------------

export const createPaymentIntentSchema = z.object({
  orderId: z.string().min(1),
});

export const refundSchema = z.object({
  amountPaise: paiseSchema.optional(), // na do to poora refund
  reason: z.string().trim().max(120).optional(),
});

export const paymentStatusQuerySchema = z.object({
  /** Long-poll friendly: client jab tak status PENDING hai tab tak poll karta hai. */
  includeQr: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => v === true || v === "true"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;
export type RefundInput = z.infer<typeof refundSchema>;

/** Provider ka naam — naya gateway add karna ho to yahan ek value add karo. */
export const paymentProviders = ["razorpay"] as const;
export type PaymentProviderName = (typeof paymentProviders)[number];
