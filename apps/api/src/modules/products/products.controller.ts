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
      // CDN cache: catalog public hai, price sirf server se aata hai.
      // `s-maxage` = Vercel edge par 60s tak cached (India me ~10-30ms), background
      // revalidate 5 min tak purana jawab deta rahega.
      res.setHeader("cache-control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
      res.setHeader("cdn-cache-control", "public, s-maxage=60, stale-while-revalidate=300");
      res.json({ data, meta: { count: data.length } });
    },

    async get(req: Request, res: Response): Promise<void> {
      const product = await products.get(req.params.id ?? "");
      if (!product) throw AppError.notFound("PRODUCT_NOT_FOUND", "Ye product nahi mila.");
      res.setHeader("cache-control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
      res.setHeader("cdn-cache-control", "public, s-maxage=60, stale-while-revalidate=300");
      res.json({ data: product });
    },
  };
}
