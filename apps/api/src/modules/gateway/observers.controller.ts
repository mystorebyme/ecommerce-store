// Purpose: observers: Request/response handling (admin/debug view)
//
// Ingest khud `webhooks/observer.webhook.ts` me hai (raw body + HMAC chahiye).
// Yahan sirf read-only views hain: recent observations aur unmatched credits.

import type { Request, Response } from "express";
import type { Db } from "../../config/db";

export function createObserversController(db: Db) {
  return {
    async unmatched(req: Request, res: Response): Promise<void> {
      const merchant = await db.getMerchant();
      const limit = Number(req.query.limit ?? 20);
      const rows = merchant
        ? await db.listSessionsByStatus(merchant.id, "SUSPICIOUS")
        : [];
      res.json({
        data: {
          suspiciousSessions: rows.slice(0, limit).map((session) => ({
            sessionId: session.id,
            orderId: session.orderId,
            amountPaise: session.amountPaise,
            reference: session.reference,
            status: session.status,
            reason: session.failureReason,
            utr: session.utr,
          })),
        },
      });
    },
  };
}
