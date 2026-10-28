// Purpose: observers: URL routes (read-only admin/debug views)

import { Router } from "express";
import type { Db } from "../../config/db";
import { asyncHandler } from "../../middlewares/error.middleware";
import { createObserversController } from "./observers.controller";

export function createObserversRouter(db: Db): Router {
  const router = Router();
  const controller = createObserversController(db);
  router.get("/suspicious", asyncHandler(controller.unmatched));
  return router;
}
