// Purpose: ek hi round-trip me order + UPI QR (buyer ka "Pay" button)
//
// Pehle browser do call karta tha: POST /orders → phir POST /payments.
// Do network round-trip + do cold-start chances. Yahan dono kaam server par
// sequence me hote hain, browser ko ek hi jawab milta hai (~150-300ms bachta hai).
//
// Invariants wahi rehte hain: price server se, stock atomic, idempotent order,
// payment sirf observer se confirm.

import { Router } from "express";
import type { Request, Response } from "express";
import { getDb } from "../../config/db";
import { AppError, asyncHandler } from "../../middlewares/error.middleware";
import { idempotency } from "../../middlewares/idempotency.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createOrderSchema, toOrderResponse } from "../orders/orders.schema";
import { createOrdersService } from "../orders/orders.service";
import type { PaymentsService } from "./payments.service";

export function createCheckoutRouter(payments: PaymentsService): Router {
  const router = Router();

  router.post(
    "/",
    idempotency(),
    validate(createOrderSchema),
    asyncHandler(async (req: Request, res: Response) => {
      if (!req.idempotencyKey) {
        throw AppError.badRequest("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header chahiye.");
      }

      const db = getDb();
      const orders = createOrdersService({ db });
      const result = await orders.create(req.body, req.idempotencyKey);

      // QR already live hai (retry/replay) to naya session nahi — wahi wapas.
      let payment;
      try {
        payment = await payments.start({ orderId: result.order.id });
      } catch (error) {
        // Order ban gaya par QR nahi — buyer ko order dikhao, wo dobara try kar sakta hai.
        res.status(201).json({
          data: { order: toOrderResponse(result.order), payment: null },
          meta: { replayed: result.replayed, paymentError: (error as Error).message },
        });
        return;
      }

      res.status(201).json({
        data: { order: toOrderResponse(result.order), payment },
        meta: { replayed: result.replayed },
      });
    }),
  );

  return router;
}
