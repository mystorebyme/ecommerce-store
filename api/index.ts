// Purpose: Vercel root — API ka short landing (health + docs pointer)

import type { IncomingMessage, ServerResponse } from "node:http";

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify({
      service: "youpi-gateway-api",
      version: "1.0.0",
      gateway: "self-hosted UPI (no aggregator)",
      endpoints: {
        health: "/api/v1/health",
        products: "/api/v1/products",
        orders: "POST /api/v1/orders",
        payments: "POST /api/v1/payments",
        observers: "POST /api/v1/observers/observations",
      },
    }),
  );
}
