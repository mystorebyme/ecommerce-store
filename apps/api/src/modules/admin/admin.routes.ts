// Purpose: Admin routes — merchant config, live board, manual confirm, webhook deliveries
//
// Sab routes `x-admin-token` se protected hain (ADMIN_API_TOKEN). Merchant config ko
// `merchant.controller.ts` handle karta hai; yahan baaki ops routes hain.

import { Router } from "express";
import { merchantConfigSchema, manualConfirmSchema } from "@youpi/validation";
import type { Db } from "../../config/db";
import { asyncHandler } from "../../middlewares/error.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createAdminController } from "./admin.controller";
import type { GatewayService } from "../gateway/gateway.service";
import type { MerchantWebhookService } from "../payments/merchant-webhook.service";

export interface AdminRouterDeps {
  db: Db;
  gateway: GatewayService;
  merchantWebhooks: MerchantWebhookService;
  adminToken: string;
  /** Tests me clock inject hota hai (timers deterministic rahein). */
  now?: () => Date;
}

export function createAdminRouter(deps: AdminRouterDeps): Router {
  const router = Router();
  const controller = createAdminController(deps);

  // merchant (VPA) config
  router.get("/merchant", asyncHandler(controller.getMerchant));
  router.post("/merchant", validate(merchantConfigSchema), asyncHandler(controller.setMerchant));

  // live board + manual proof
  router.get("/sessions", asyncHandler(controller.listSessions));
  router.post("/sessions/:id/confirm", validate(manualConfirmSchema), asyncHandler(controller.confirmSession));

  // merchant webhook deliveries (retry visibility + manual replay)
  router.get("/deliveries", asyncHandler(controller.listDeliveries));
  router.post("/deliveries/:deliveryId/replay", asyncHandler(controller.replayDelivery));

  return router;
}
