// Purpose: payments: URL routes
//
//   POST /api/v1/payments/intents        → naya attempt + single-use UPI QR
//   GET  /api/v1/payments/:id            → status (buyer polling, webhook ka safety net)
//   POST /api/v1/payments/:id/verify     → Razorpay Checkout response verify
//   POST /api/v1/payments/:id/refund     → refund (partial allowed)  [admin auth baad me]

import { Router } from "express";
import { createPaymentIntentSchema, refundSchema } from "@youpi/validation";
import { verifyCheckoutSchema } from "./payments.schema";
import { asyncHandler } from "../../middlewares/error.middleware";
import { idempotency } from "../../middlewares/idempotency.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createPaymentsController } from "./payments.controller";
import type { createPaymentsService } from "./payments.service";

export function createPaymentsRouter(service: ReturnType<typeof createPaymentsService>): Router {
  const router = Router();
  const controller = createPaymentsController(service);

  router.post(
    "/intents",
    idempotency(),
    validate(createPaymentIntentSchema),
    asyncHandler(controller.createIntent),
  );
  router.get("/:id", asyncHandler(controller.getStatus));
  router.post("/:id/verify", validate(verifyCheckoutSchema), asyncHandler(controller.verifyCheckout));
  router.post("/:id/refund", validate(refundSchema), asyncHandler(controller.refund));

  return router;
}
