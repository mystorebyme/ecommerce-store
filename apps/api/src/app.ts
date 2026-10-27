// Purpose: Express app: webhooks pehle (raw body), phir express.json, phir modules
//
// Ye order optional nahi hai. Agar `express.json()` pehle laga diya to webhook ka
// raw body kho jaata hai aur signature kabhi verify nahi hoti (classic bug).

import cors from "cors";
import express, { type Express, type Request, type Response } from "express";
import { setDb, type Db } from "./config/db";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { requestId } from "./middlewares/request-id.middleware";
import { ordersRouter } from "./modules/orders/orders.routes";
import { createPaymentsRouter } from "./modules/payments/payments.routes";
import type { PaymentsConfig } from "./modules/payments/payments.service";
import { createPaymentsService } from "./modules/payments/payments.service";
import type { PaymentProvider } from "./modules/payments/providers/provider.interface";
import { createRazorpayWebhook } from "./webhooks/razorpay.webhook";

export interface AppDeps {
  db: Db;
  provider: PaymentProvider;
  paymentsConfig: PaymentsConfig;
  /** CORS allow-list. */
  webOrigin: string;
  onPaid?: (paymentId: string) => Promise<void> | void;
}

export function createApp({ db, provider, paymentsConfig, webOrigin, onPaid }: AppDeps): Express {
  // Controllers `getDb()` se db lete hain — yahan inject kiya hua db set karte hain
  // taaki server aur tests dono same instance use karein (koi global surprise nahi).
  setDb(db);

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);

  app.use(requestId);

  const payments = createPaymentsService({
    db,
    provider,
    config: paymentsConfig,
    onPaid: onPaid
      ? async (payment) => {
          await onPaid(payment.id);
        }
      : undefined,
  });

  // Server/scheduler ko wahi instance chahiye jo routes use kar rahe hain.
  app.locals.payments = payments;

  // -------------------------------------------------------------------------
  // 1. Webhooks — RAW body, express.json se pehle.
  // -------------------------------------------------------------------------
  app.post(
    "/api/v1/webhooks/razorpay",
    express.raw({ type: "*/*", limit: "1mb" }),
    (req: Request, _res: Response, next) => {
      req.rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
      next();
    },
    async (req, res, next) => {
      try {
        await createRazorpayWebhook({ db, provider, payments })(req, res);
      } catch (error) {
        next(error);
      }
    },
  );

  // -------------------------------------------------------------------------
  // 2. Ab normal JSON APIs.
  // -------------------------------------------------------------------------
  app.use(express.json({ limit: "128kb" }));
  app.use(
    cors({
      origin: webOrigin,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["content-type", "idempotency-key", "x-request-id"],
      exposedHeaders: ["x-request-id"],
    }),
  );

  app.get("/api/v1/health", (_req, res) => {
    res.json({
      status: "ok",
      provider: provider.name,
      ttlSeconds: paymentsConfig.ttlSeconds,
      time: new Date().toISOString(),
    });
  });

  app.use("/api/v1/orders", ordersRouter);
  app.use("/api/v1/payments", createPaymentsRouter(payments));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
