// Purpose: payments: URL routes
//
//   POST /api/v1/payments          → session + single-use UPI QR (orderId)
//   GET  /api/v1/payments/:id      → status, queue position, timers, QR
//   POST /api/v1/payments/:id/cancel → buyer ne chhoda, slot free
//   GET  /api/v1/payments/order/:orderId/attempts → history

import { Router } from "express";
import { asyncHandler } from "../../middlewares/error.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createPaymentsController } from "./payments.controller";
import { startPaymentSchema } from "./payments.schema";
import type { PaymentsService } from "./payments.service";

export function createPaymentsRouter(service: PaymentsService): Router {
  const router = Router();
  const controller = createPaymentsController(service);

  router.post("/", validate(startPaymentSchema), asyncHandler(controller.start));
  router.get("/order/:orderId/attempts", asyncHandler(controller.attempts));
  router.get("/:id", asyncHandler(controller.status));
  router.post("/:id/cancel", asyncHandler(controller.cancel));

  return router;
}
