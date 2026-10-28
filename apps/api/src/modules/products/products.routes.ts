// Purpose: products: URL routes — public catalog (koi auth nahi, sirf padhne ke liye)

import { Router } from "express";
import type { Db } from "../../config/db";
import { asyncHandler } from "../../middlewares/error.middleware";
import { createProductsController } from "./products.controller";
import { createProductsService } from "./products.service";

export function createProductsRouter({ db }: { db: Db }): Router {
  const router = Router();
  const controller = createProductsController({ products: createProductsService({ db }) });

  router.get("/", asyncHandler(controller.list));
  router.get("/:id", asyncHandler(controller.get));

  return router;
}
