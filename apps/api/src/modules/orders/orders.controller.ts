// Purpose: orders: Request/response handling
//
// Controller patla rehta hai: validate (middleware) → service → JSON.

import type { Request, Response } from "express";
import { getDb } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { toOrderResponse } from "./orders.schema";
import { createOrdersService } from "./orders.service";

const service = () => createOrdersService({ db: getDb() });

export async function createOrder(req: Request, res: Response): Promise<void> {
  if (!req.idempotencyKey) {
    throw AppError.badRequest("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header chahiye.");
  }
  const result = await service().create(req.body, req.idempotencyKey);
  res.status(result.replayed ? 200 : 201).json({
    data: toOrderResponse(result.order),
    meta: { replayed: result.replayed },
  });
}

export async function getOrder(req: Request, res: Response): Promise<void> {
  const order = await getDb().findOrderById(req.params.id ?? "");
  if (!order) throw AppError.notFound("ORDER_NOT_FOUND", "Order nahi mila.");
  res.json({ data: toOrderResponse(order) });
}
