// Purpose: products: Module tests — public catalog (storefront isi par chalta hai)

import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, test } from "node:test";
import { createApp } from "../../app";
import { createMemoryDb, type MemoryDb } from "../../../../../tests/fixtures/memory-db";

let db: MemoryDb;
let server: Server;
let baseUrl: string;

beforeEach(async () => {
  db = createMemoryDb();
  db.seedProduct({ id: "p-in-stock", pricePaise: 189900, stock: 4 });
  db.seedProduct({ id: "p-sold-out", pricePaise: 249900, stock: 0 });

  const { app } = createApp({
    db,
    observerSecret: "observer_shared_secret_123456",
    adminToken: "admin_token_1234567890",
    webOrigin: "http://localhost:3001",
  });

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("catalog: active products price + stock ke saath", async () => {
  const response = await fetch(`${baseUrl}/api/v1/products`);
  assert.equal(response.status, 200);

  const json = (await response.json()) as {
    data: { id: string; pricePaise: number; inStock: boolean; stock: number }[];
    meta: { count: number };
  };

  assert.equal(json.meta.count, 2);
  const inStock = json.data.find((product) => product.id === "p-in-stock")!;
  assert.equal(inStock.pricePaise, 189900);
  assert.equal(inStock.inStock, true);
  assert.equal(inStock.stock, 4);

  // Out-of-stock bhi dikhta hai (par `inStock: false`) — UI "Sold out" dikha sakta hai
  const soldOut = json.data.find((product) => product.id === "p-sold-out")!;
  assert.equal(soldOut.inStock, false);
});

test("catalog: single product + unknown id par 404", async () => {
  const found = await fetch(`${baseUrl}/api/v1/products/p-in-stock`);
  assert.equal(found.status, 200);
  const json = (await found.json()) as { data: { sku: string; pricePaise: number } };
  assert.equal(json.data.pricePaise, 189900);

  const missing = await fetch(`${baseUrl}/api/v1/products/does-not-exist`);
  assert.equal(missing.status, 404);
  const error = (await missing.json()) as { error: { code: string } };
  assert.equal(error.error.code, "PRODUCT_NOT_FOUND");
});

test("catalog: inactive product list aur detail dono se chhup jaata hai", async () => {
  db.seedProduct({ id: "p-hidden", pricePaise: 100000, stock: 9, active: false });

  const list = await fetch(`${baseUrl}/api/v1/products`);
  const json = (await list.json()) as { data: { id: string }[] };
  assert.equal(json.data.some((product) => product.id === "p-hidden"), false);

  const detail = await fetch(`${baseUrl}/api/v1/products/p-hidden`);
  assert.equal(detail.status, 404);
});
