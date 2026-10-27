// Purpose: payments API-only schemas (shared rules packages/validation se import)

import {
  createPaymentIntentSchema,
  refundSchema,
  type CreatePaymentIntentInput,
  type RefundInput,
} from "@youpi/validation";
import { z } from "zod";

export { createPaymentIntentSchema, refundSchema };
export type { CreatePaymentIntentInput, RefundInput };

/** Checkout (card/UPI app) response verify karne ke liye — Razorpay ke field naam. */
export const verifyCheckoutSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});
export type VerifyCheckoutInput = z.infer<typeof verifyCheckoutSchema>;
