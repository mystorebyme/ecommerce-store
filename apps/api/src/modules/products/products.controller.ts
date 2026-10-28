// Purpose: products: Request/response handling — public catalog endpoints

import type { Request, Response } from "express";
import { AppError } from "../../middlewares/error.middleware";
import type { ProductsService } from "./products.service";

export interface ProductsControllerDeps {
  products: ProductsService;
}

export function createProductsController({ products }: ProductsControllerDeps) {
  return {
    async list(req: Request, res: Response): Promise<void> {
      const limit = Number(req.query.limit ?? 24);
      const data = await products.list({ limit: Number.isFinite(limit) ? limit : 24 });
      res.setHeader("cache-control", "public, max-age=30");
      res.json({ data, meta: { count: data.length } });
    },

    async get(req: Request, res: Response): Promise<void> {
      const product = await products.get(req.params.id ?? "");
      if (!product) throw AppError.notFound("PRODUCT_NOT_FOUND", "Ye product nahi mila.");
      res.json({ data: product });
    },
  };
}
