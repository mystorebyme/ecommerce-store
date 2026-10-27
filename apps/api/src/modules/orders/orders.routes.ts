// Purpose: orders: URL routes

import { Router } from "express";
import { asyncHandler } from "../../middlewares/error.middleware";
import { idempotency } from "../../middlewares/idempotency.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createOrder, getOrder } from "./orders.controller";
import { createOrderSchema } from "./orders.schema";

export const ordersRouter: Router = Router();

ordersRouter.post("/", idempotency(), validate(createOrderSchema), asyncHandler(createOrder));
ordersRouter.get("/:id", asyncHandler(getOrder));
