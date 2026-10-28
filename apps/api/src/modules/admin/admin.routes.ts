// Purpose: Admin routes — merchant config (x-admin-token protected)

import { Router } from "express";
import { merchantConfigSchema } from "@youpi/validation";
import type { Db } from "../../config/db";
import { asyncHandler } from "../../middlewares/error.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createAdminController } from "./merchant.controller";

export function createAdminRouter(db: Db, adminToken: string): Router {
  const router = Router();
  const controller = createAdminController({ db, adminToken });

  router.get("/merchant", asyncHandler(controller.getMerchant));
  router.post("/merchant", validate(merchantConfigSchema), asyncHandler(controller.setMerchant));

  return router;
}
