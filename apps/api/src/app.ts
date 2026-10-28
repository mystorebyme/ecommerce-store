// Purpose: Express app: webhooks pehle (raw body), phir express.json, phir modules
//
// Ye order optional nahi hai. Observer ka signature raw body par banta hai — agar
// `express.json()` pehle lag gaya to raw body kho jaata hai aur signature kabhi
// verify nahi hoti (classic bug).

import cors from "cors";
import express, { type Express, type Request, type Response } from "express";
import type { Db } from "./config/db";
import { setDb } from "./config/db";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { requestId } from "./middlewares/request-id.middleware";
import { createAdminRouter } from "./modules/admin/admin.routes";
import { createGatewayService, type GatewayService } from "./modules/gateway/gateway.service";
import { createObserversService, type ObserversService } from "./modules/gateway/observers.service";
import { createObserversRouter } from "./modules/gateway/observers.routes";
import { createMerchantWebhookService, type MerchantWebhookService } from "./modules/payments/merchant-webhook.service";
import { createPaymentsService } from "./modules/payments/payments.service";
import { createPaymentsRouter } from "./modules/payments/payments.routes";
import { ordersRouter } from "./modules/orders/orders.routes";
import { createProductsRouter } from "./modules/products/products.routes";
import { verifyHmacSha256 } from "./utils/signature";
import { createObserverWebhook } from "./webhooks/observer.webhook";

export interface AppDeps {
  db: Db;
  /** Observers ka shared secret — khaali string = observers band. */
  observerSecret: string;
  adminToken: string;
  webOrigin: string;
  now?: () => Date;
  /** Test/telemetry hooks. */
  onSettled?: (input: Parameters<NonNullable<Parameters<typeof createGatewayService>[0]["onSettled"]>>[0]) => Promise<void> | void;
}

export interface AppHandles {
  app: Express;
  gateway: GatewayService;
  observers: ObserversService;
  merchantWebhooks: MerchantWebhookService;
  payments: ReturnType<typeof createPaymentsService>;
}

export function createApp(deps: AppDeps): AppHandles {
  // Controllers `getDb()` se db lete hain — inject kiya hua instance set karte hain.
  setDb(deps.db);

  const merchantWebhooks = createMerchantWebhookService({ db: deps.db, now: deps.now });

  const gateway = createGatewayService({
    db: deps.db,
    now: deps.now,
    onSettled: async (input) => {
      await deps.onSettled?.(input);
      // Merchant ko signed proof — ye fail ho to payment phir bhi SUCCESS rehta hai.
      await merchantWebhooks.dispatch(input).catch(() => undefined);
    },
  });

  const observers = createObserversService({ db: deps.db, gateway, now: deps.now });
  const payments = createPaymentsService({ db: deps.db, gateway });

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(requestId);

  // -------------------------------------------------------------------------
  // 1. Observer webhook — RAW body, express.json se pehle.
  // -------------------------------------------------------------------------
  app.post(
    "/api/v1/observers/observations",
    express.raw({ type: "*/*", limit: "64kb" }),
    (req: Request, _res: Response, next) => {
      req.rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
      next();
    },
    async (req, res, next) => {
      try {
        await createObserverWebhook({
          observers,
          secret: deps.observerSecret,
          verifySignature: verifyHmacSha256,
        })(req, res);
      } catch (error) {
        next(error);
      }
    },
  );

  // -------------------------------------------------------------------------
  // 2. Normal JSON APIs.
  // -------------------------------------------------------------------------
  app.use(express.json({ limit: "128kb" }));
  app.use(
    cors({
      origin: deps.webOrigin,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["content-type", "idempotency-key", "x-request-id", "x-admin-token"],
      exposedHeaders: ["x-request-id"],
    }),
  );

  app.get("/api/v1/health", async (_req, res) => {
    const merchant = await deps.db.getMerchant();
    res.json({
      status: "ok",
      gateway: "youpi-selfhosted",
      merchantVpa: merchant?.vpa ?? null,
      payWindowSeconds: merchant?.payWindowSeconds ?? null,
      verifyWindowSeconds: merchant?.verifyWindowSeconds ?? null,
      observersEnabled: Boolean(deps.observerSecret),
      webhookDelivery: Boolean(merchant?.webhookUrl),
      time: new Date().toISOString(),
    });
  });

  app.use(
    "/api/v1/admin",
    createAdminRouter({
      db: deps.db,
      gateway,
      merchantWebhooks,
      adminToken: deps.adminToken,
      now: deps.now,
    }),
  );
  // Public catalog — storefront isse products padhta hai (koi auth nahi).
  app.use("/api/v1/products", createProductsRouter({ db: deps.db }));
  app.use("/api/v1/orders", ordersRouter);
  app.use("/api/v1/payments", createPaymentsRouter(payments));
  app.use("/api/v1/observers", createObserversRouter(deps.db));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, gateway, observers, merchantWebhooks, payments };
}
