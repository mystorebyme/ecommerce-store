// Purpose: Payment links — admin CRUD + public pay pages ka API
//
// Admin (x-admin-token):
//   GET    /api/v1/admin/links
//   POST   /api/v1/admin/links
//   POST   /api/v1/admin/links/:id/disable
//
// Public (rate limited):
//   GET    /api/v1/pay/limits                 → open-link min/max + payee
//   GET    /api/v1/pay/links/:token           → link ki public info (amount server se)
//   POST   /api/v1/pay/links/:token           → order + UPI QR (fixed par amount lock)

import { Router } from "express";
import type { Request, Response } from "express";
import { createPaymentLinkSchema, paiseSchema, phoneSchema, startLinkPaymentSchema } from "@youpi/validation";
import { z } from "zod";
import { asyncHandler } from "../../middlewares/error.middleware";
import { auditContext, requireAdminToken } from "../../middlewares/admin.middleware";
import { rateLimit } from "../../middlewares/rate-limit.middleware";
import { validate } from "../../middlewares/validate.middleware";
import type { Db } from "../../config/db";
import type { PaymentsService } from "./payments.service";
import type { LinksService } from "./links.service";
import type { SettingsService } from "../settings/settings.service";

function linkResponse(link: {
  id: string;
  token: string;
  kind: string;
  title: string;
  note: string;
  amountPaise: number | null;
  minAmountPaise: number | null;
  maxAmountPaise: number | null;
  status: string;
  maxUses: number;
  usedCount: number;
  expiresAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: link.id,
    token: link.token,
    path: `/pay/${link.token}`,
    kind: link.kind,
    title: link.title,
    note: link.note,
    amountPaise: link.amountPaise,
    minAmountPaise: link.minAmountPaise,
    maxAmountPaise: link.maxAmountPaise,
    status: link.status,
    maxUses: link.maxUses,
    usedCount: link.usedCount,
    expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
    createdAt: link.createdAt.toISOString(),
  };
}

export function createLinksAdminRouter({ links, adminToken }: { links: LinksService; adminToken: string }): Router {
  const router = Router();
  router.use(requireAdminToken(adminToken));

  router.get(
    "/",
    asyncHandler(async (_req: Request, res: Response) => {
      res.setHeader("cache-control", "no-store");
      res.json({ data: (await links.list(200)).map(linkResponse) });
    }),
  );

  router.post(
    "/",
    validate(createPaymentLinkSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const created = await links.create(req.body, auditContext(req).actor);
      res.status(201).json({ data: linkResponse(created) });
    }),
  );

  router.post(
    "/:id/disable",
    asyncHandler(async (req: Request, res: Response) => {
      const ctx = auditContext(req);
      const updated = await links.disable(req.params.id ?? "", ctx.actor, ctx);
      res.json({ data: linkResponse(updated) });
    }),
  );

  return router;
}

export function createPayRouter({
  links,
  settings,
  payments,
  db,
}: {
  links: LinksService;
  settings: SettingsService;
  payments: PaymentsService;
  db: Db;
}): Router {
  const router = Router();
  const payLimiter = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "pay" });

  router.get(
    "/limits",
    asyncHandler(async (_req: Request, res: Response) => {
      const [limits, merchant] = await Promise.all([settings.limits(), db.getMerchant()]);
      res.setHeader("cache-control", "public, max-age=0, s-maxage=60, stale-while-revalidate=120");
      res.json({
        data: {
          minAmountPaise: limits.minAmountPaise,
          maxAmountPaise: limits.maxAmountPaise,
          payee: merchant ? { name: merchant.payeeName, vpa: merchant.vpa } : null,
        },
      });
    }),
  );

  router.post(
    "/open",
    payLimiter,
    validate(
      z.object({
        amountPaise: paiseSchema,
        customerName: z.string().trim().min(2).max(80),
        customerPhone: phoneSchema,
        note: z.string().trim().max(40).optional(),
      }),
    ),
    asyncHandler(async (req: Request, res: Response) => {
      const started = await links.startOpen({
        amountPaise: req.body.amountPaise,
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        note: req.body.note,
      });
      const session = await payments.status({ sessionId: started.sessionId });
      res.status(201).json({
        data: { orderId: started.orderId, amountPaise: started.amountPaise, payment: session },
      });
    }),
  );

  router.get(
    "/links/:token",
    asyncHandler(async (req: Request, res: Response) => {
      res.setHeader("cache-control", "no-store");
      res.json({ data: await links.publicView(req.params.token ?? "") });
    }),
  );

  router.post(
    "/links/:token",
    payLimiter,
    validate(startLinkPaymentSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const started = await links.start({
        token: req.params.token ?? "",
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        amountPaise: req.body.amountPaise,
      });
      const session = await payments.status({ sessionId: started.sessionId });
      res.status(201).json({
        data: { orderId: started.orderId, amountPaise: started.amountPaise, payment: session },
      });
    }),
  );

  return router;
}
