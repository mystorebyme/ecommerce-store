// Purpose: products: Business logic — public, read-only storefront catalog
//
// Storefront ko sirf wahi dikhta hai jo bik sakta hai: `active` products.
// Price hamesha server se aata hai (client ka bheja price kabhi trust nahi hota).

import type { Db, ProductRow } from "../../config/db";

export interface ProductView {
  id: string;
  sku: string;
  name: string;
  pricePaise: number;
  inStock: boolean;
  stock: number;
}

export interface ProductsService {
  list(input: { limit?: number }): Promise<ProductView[]>;
  get(id: string): Promise<ProductView | null>;
}

export function toProductView(product: ProductRow): ProductView {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    pricePaise: product.pricePaise,
    inStock: product.stock > 0,
    stock: product.stock,
  };
}

export function createProductsService({ db }: { db: Db }): ProductsService {
  return {
    async list(input) {
      const limit = Math.min(Math.max(input.limit ?? 24, 1), 60);
      const rows = await db.listProducts(limit);
      return rows.map(toProductView);
    },
    async get(id) {
      const row = await db.findProductById(id);
      return row && row.active ? toProductView(row) : null;
    },
  };
}
