// Purpose: Admin ops endpoints — jab observer (SMS/email) na ho ya der se aaye.
//
// Real life me ye 3 screens sabse zyada kaam aate hain:
//   1. GET  /admin/sessions      → kaun-kaun abhi pay kar raha hai (live board)
//   2. POST /admin/sessions/:id/confirm → "bank app me paisa dikh raha hai" (manual proof)
//   3. GET  /admin/deliveries + POST /admin/deliveries/:id/replay → merchant webhook status
//
// Manual confirm bhi ek observation hi banati hai (source MANUAL, status MATCHED), isliye
// reconciliation 1:1 rehti hai — "kaun keh raha hai ki paisa aaya" ka record rehta hai.

import type { Request, Response } from "express";
import type { Db, DeliveryRow, MerchantRow, SessionStatus } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import type { GatewayService, SessionView } from "../gateway/gateway.service";
import type { MerchantWebhookService } from "../payments/merchant-webhook.service";
import type { MerchantConfigInput } from "@youpi/validation";

export interface AdminDeps {
  db: Db;
  gateway: GatewayService;
  merchantWebhooks: MerchantWebhookService;
  adminToken: string;
  now?: () => Date;
}

const LIVE_STATUSES: SessionStatus[] = ["QUEUED", "ACTIVE", "PROCESSING"];

function toPublic(merchant: MerchantRow) {
  return {
    id: merchant.id,
    name: merchant.name,
    vpa: merchant.vpa,
    payeeName: merchant.payeeName,
    webhookUrl: merchant.webhookUrl,
    webhookSecretSet: Boolean(merchant.webhookSecret),
    payWindowSeconds: merchant.payWindowSeconds,
    verifyWindowSeconds: merchant.verifyWindowSeconds,
  };
}

function secondsLeft(target: Date, from: Date): number {
  return Math.max(0, Math.round((target.getTime() - from.getTime()) / 1000));
}

export function createAdminController({ db, gateway, merchantWebhooks, adminToken, now = () => new Date() }: AdminDeps) {
  function authorize(req: Request): void {
    if (!adminToken) {
      throw AppError.unavailable("ADMIN_TOKEN_MISSING", "ADMIN_API_TOKEN set nahi hai — admin routes band hain.");
    }
    if (req.header("x-admin-token") !== adminToken) {
      throw AppError.unauthorized("ADMIN_UNAUTHORIZED", "x-admin-token galat hai.");
    }
  }

  async function requireMerchant(): Promise<MerchantRow> {
    const merchant = await db.getMerchant();
    if (!merchant) throw AppError.unavailable("MERCHANT_NOT_CONFIGURED", "Pehle merchant VPA set karo.");
    return merchant;
  }

  async function view(sessionId: string): Promise<SessionView> {
    return gateway.getView(sessionId);
  }

  function deliverySummary(delivery: DeliveryRow) {
    return {
      deliveryId: delivery.deliveryId,
      event: delivery.event,
      status: delivery.status,
      attempts: delivery.attempts,
      lastStatusCode: delivery.lastStatusCode,
      lastError: delivery.lastError,
      createdAt: delivery.createdAt.toISOString(),
      deliveredAt: delivery.deliveredAt ? delivery.deliveredAt.toISOString() : null,
      nextAttemptAt: delivery.nextAttemptAt.toISOString(),
    };
  }

  return {
    // ---------------- merchant config ----------------
    async getMerchant(req: Request, res: Response): Promise<void> {
      authorize(req);
      const merchant = await db.getMerchant();
      res.json({ data: merchant ? toPublic(merchant) : null });
    },

    async setMerchant(req: Request, res: Response): Promise<void> {
      authorize(req);
      const input = req.body as MerchantConfigInput;
      const merchant = await db.upsertMerchant({
        name: input.name,
        vpa: input.vpa,
        payeeName: input.payeeName,
        webhookUrl: input.webhookUrl ?? null,
        webhookSecret: input.webhookSecret ?? null,
        payWindowSeconds: input.payWindowSeconds,
        verifyWindowSeconds: input.verifyWindowSeconds,
      });
      res.json({ data: toPublic(merchant) });
    },

    // ---------------- live board ----------------
    /**
     * GET /admin/sessions?status=ACTIVE,QUEUED,PROCESSING
     * Default: live sessions (jo abhi paisa le sakte hain).
     */
    async listSessions(req: Request, res: Response): Promise<void> {
      authorize(req);
      const merchant = await requireMerchant();
      const requested = String(req.query.status ?? "")
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean) as SessionStatus[];
      const statuses = requested.length > 0 ? requested : LIVE_STATUSES;
      const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
      const current = now();

      // Timers pehle evaluate — warna board purana data dikhayega.
      await gateway.runTimers();
      const sessions = await db.listSessionsByStatuses(merchant.id, statuses, limit);

      res.json({
        data: sessions.map((session) => ({
          sessionId: session.id,
          orderId: session.orderId,
          amountPaise: session.amountPaise,
          reference: session.reference,
          status: session.status,
          utr: session.utr,
          payExpiresAt: session.payExpiresAt.toISOString(),
          secondsLeftToPay: session.status === "ACTIVE" ? secondsLeft(session.payExpiresAt, current) : 0,
          secondsLeftToVerify: session.verifyExpiresAt ? secondsLeft(session.verifyExpiresAt, current) : null,
          createdAt: session.createdAt.toISOString(),
        })),
        meta: { count: sessions.length, statuses },
      });
    },

    // ---------------- manual confirm ----------------
    /**
     * POST /admin/sessions/:id/confirm { utr, senderVpa?, note? }
     * Jab bank app me paisa dikhe par SMS observer ne na bheja ho.
     */
    async confirmSession(req: Request, res: Response): Promise<void> {
      authorize(req);
      const merchant = await requireMerchant();
      const session = await db.findSessionById(req.params.id ?? "");
      if (!session) throw AppError.notFound("SESSION_NOT_FOUND", "Payment session nahi mila.");
      if (session.merchantId !== merchant.id) {
        throw AppError.forbidden("SESSION_FOREIGN", "Ye session is merchant ka nahi hai.");
      }
      if (session.status === "SUCCESS") {
        res.json({ data: await view(session.id), meta: { alreadyConfirmed: true } });
        return;
      }
      if (!LIVE_STATUSES.includes(session.status)) {
        throw AppError.conflict(
          "SESSION_NOT_CONFIRMABLE",
          `Session ${session.status} hai — sirf QUEUED/ACTIVE/PROCESSING confirm ho sakte hain.`,
        );
      }

      const body = req.body as { utr: string; senderVpa?: string; note?: string };
      const amountPaise = (req.body as { amountPaise?: number }).amountPaise ?? session.amountPaise;

      if (amountPaise !== session.amountPaise) {
        throw AppError.conflict(
          "ORDER_AMOUNT_MISMATCH",
          `Bank me ₹${(amountPaise / 100).toFixed(2)} dikha, session ₹${(session.amountPaise / 100).toFixed(2)} ka hai — confirm nahi kiya.`,
        );
      }

      // Audit: manual proof bhi ek observation hi hai (reconciliation 1:1 rehti hai).
      const existing = await db.findObservationsByUtr(body.utr);
      if (existing.length === 0) {
        await db.insertObservation({
          source: "MANUAL",
          deviceId: "admin-console",
          messageId: `manual:${session.id}:${body.utr}`,
          rawText: `manual confirm by admin${body.note ? `: ${body.note}` : ""}`.slice(0, 500),
          amountPaise,
          utr: body.utr,
          senderVpa: body.senderVpa ?? null,
          bankName: null,
          direction: "CREDIT",
          observedAt: now(),
        });
      }

      const observations = await db.findObservationsByUtr(body.utr);
      const manual = observations.find((observation) => observation.source === "MANUAL") ?? observations[0];
      if (manual) await db.updateObservation(manual.id, { status: "MATCHED", sessionId: session.id });

      await gateway.settle({ sessionId: session.id, utr: body.utr, senderVpa: body.senderVpa ?? null });
      res.json({ data: await view(session.id), meta: { confirmedBy: "admin", utr: body.utr } });
    },

    // ---------------- merchant webhook deliveries ----------------
    async listDeliveries(req: Request, res: Response): Promise<void> {
      authorize(req);
      const status = String(req.query.status ?? "PENDING").toUpperCase() as DeliveryRow["status"];
      const limit = Math.min(Number(req.query.limit ?? 25) || 25, 100);
      const rows = await db.listDeliveries(status, limit);
      res.json({ data: rows.map(deliverySummary), meta: { status, count: rows.length } });
    },

    async replayDelivery(req: Request, res: Response): Promise<void> {
      authorize(req);
      const delivery = await db.findDeliveryByDeliveryId(req.params.deliveryId ?? "");
      if (!delivery) throw AppError.notFound("DELIVERY_NOT_FOUND", "Delivery nahi mili.");
      await merchantWebhooks.replay(delivery);
      const fresh = await db.findDeliveryByDeliveryId(delivery.deliveryId);
      res.json({ data: fresh ? deliverySummary(fresh) : deliverySummary(delivery) });
    },
  };
}
