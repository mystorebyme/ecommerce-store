// Purpose: payments: Request/response handling

import type { Request, Response } from "express";
import { AppError } from "../../middlewares/error.middleware";
import type { createPaymentsService } from "./payments.service";

type PaymentsService = ReturnType<typeof createPaymentsService>;

/**
 * Controller service ko argument se leta hai (module-level singleton nahi) —
 * isse tests asli HTTP ke through fake provider/db ke saath chala sakte hain.
 */
export function createPaymentsController(service: PaymentsService) {
  return {
    async createIntent(req: Request, res: Response): Promise<void> {
      if (!req.idempotencyKey) {
        throw AppError.badRequest("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header chahiye.");
      }
      const view = await service.createIntent({
        orderId: (req.body as { orderId: string }).orderId,
        idempotencyKey: req.idempotencyKey,
      });
      res.status(201).json({ data: view });
    },

    async getStatus(req: Request, res: Response): Promise<void> {
      const view = await service.getStatus({ paymentId: req.params.id ?? "" });
      res.json({ data: view });
    },

    async verifyCheckout(req: Request, res: Response): Promise<void> {
      const body = req.body as {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      };
      const view = await service.verifyCheckout({
        paymentId: req.params.id ?? "",
        providerOrderId: body.razorpay_order_id,
        providerPaymentId: body.razorpay_payment_id,
        signature: body.razorpay_signature,
      });
      res.json({ data: view });
    },

    async refund(req: Request, res: Response): Promise<void> {
      const result = await service.refund({
        paymentId: req.params.id ?? "",
        amountPaise: (req.body as { amountPaise?: number }).amountPaise,
      });
      res.json({ data: result });
    },
  };
}
