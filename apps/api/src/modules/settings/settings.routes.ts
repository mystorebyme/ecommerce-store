// Purpose: Admin settings routes — VPA staging + ₹1 test gate + open-link limits
//
//   GET    /api/v1/admin/settings                 → live VPA, pending VPA, limits
//   POST   /api/v1/admin/settings/vpa             → naya VPA stage (PENDING)
//   POST   /api/v1/admin/settings/vpa/confirm     → ₹1 test pass hone ke baad activate
//   POST   /api/v1/admin/settings/vpa/cancel      → pending hatao
//   POST   /api/v1/admin/settings/limits          → open link min/max
//   GET    /api/v1/admin/audit                    → append-only audit log

import { Router } from "express";
import type { Request, Response } from "express";
import { settingsLimitsSchema, stageVpaSchema } from "@youpi/validation";
import type { Db } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { TEST_PRODUCT } from "../products/products.bootstrap";
import { asyncHandler } from "../../middlewares/error.middleware";
import { auditContext, requireAdminToken } from "../../middlewares/admin.middleware";
import { validate } from "../../middlewares/validate.middleware";
import type { SettingsService } from "./settings.service";

export interface SettingsRouterDeps {
  settings: SettingsService;
  db: Db;
  adminToken: string;
  /** ₹1 test ke liye gateway (QR sirf pending VPA par banta hai). */
  gateway?: { startForOrder(input: { orderId: string; vpaOverride?: string | null }): Promise<unknown> };
}

export function createSettingsRouter({ settings, db, adminToken, gateway }: SettingsRouterDeps): Router {
  const router = Router();
  router.use(requireAdminToken(adminToken));

  router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response) => {
      res.setHeader("cache-control", "no-store");
      res.json({ data: await settings.view() });
    }),
  );

  router.post(
    "/vpa",
    validate(stageVpaSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const data = await settings.stageVpa(req.body, auditContext(req));
      res.status(201).json({
        data,
        meta: {
          next: "Ab ₹1 test payment karo (POST /api/v1/admin/settings/vpa/test), paisa aane par confirm karo.",
        },
      });
    }),
  );

  /**
   * POST /admin/settings/vpa/test → pending VPA par ₹1 ka QR
   *
   * Ye paid hone par `/vpa/confirm` apne aap ho jaata hai (observer/manual settle hook).
   * Purana VPA tab tak live rehta hai — yani galat VPA par customer ka paisa nahi jaata.
   */
  router.post(
    "/vpa/test",
    asyncHandler(async (req: Request, res: Response) => {
      const view = await settings.view();
      const pending = view.pendingVpa;
      if (!pending) throw AppError.badRequest("NO_PENDING_VPA", "Pehle naya VPA stage karo.");
      if (!gateway) throw AppError.unavailable("GATEWAY_MISSING", "Gateway available nahi hai.");

      await db.upsertProductBySku({ ...TEST_PRODUCT });

      const order = await db.createOrder({
        number: `YP-TEST-${Date.now().toString(36).toUpperCase()}`,
        amountPaise: TEST_PRODUCT.pricePaise,
        currency: "INR",
        customerName: "VPA Verification",
        customerPhone: "9000000000",
        idempotencyKey: `vpa-test:${pending}:${Date.now()}`,
        items: [
          {
            productId: TEST_PRODUCT.id,
            sku: TEST_PRODUCT.sku,
            name: TEST_PRODUCT.name,
            unitPricePaise: TEST_PRODUCT.pricePaise,
            qty: 1,
            lineTotalPaise: TEST_PRODUCT.pricePaise,
          },
        ],
      });

      const session = await gateway.startForOrder({ orderId: order.id, vpaOverride: pending });
      res.status(201).json({
        data: session,
        meta: {
          pendingVpa: pending,
          note: "₹1 bhejo. Observer/manual confirm hone par naya VPA apne aap live ho jayega.",
        },
      });
    }),
  );

  router.post(
    "/vpa/confirm",
    asyncHandler(async (req: Request, res: Response) => {
      res.json({ data: await settings.confirmPendingVpa(auditContext(req)) });
    }),
  );

  router.post(
    "/vpa/cancel",
    asyncHandler(async (req: Request, res: Response) => {
      res.json({ data: await settings.cancelPendingVpa(auditContext(req)) });
    }),
  );

  router.post(
    "/limits",
    validate(settingsLimitsSchema),
    asyncHandler(async (req: Request, res: Response) => {
      res.json({ data: await settings.setLimits(req.body, auditContext(req)) });
    }),
  );

  router.get(
    "/audit",
    asyncHandler(async (req: Request, res: Response) => {
      const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
      const action = typeof req.query.action === "string" ? req.query.action : undefined;
      res.setHeader("cache-control", "no-store");
      res.json({ data: await db.listAudit(limit, action) });
    }),
  );

  return router;
}
