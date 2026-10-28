// Purpose: Merchant ke server ko signed webhook delivery + retries.
//
// Yahi hamare gateway ka "proof" hai: order PAID sirf tab jab observer ne bank
// credit confirm kiya, aur merchant ko HMAC-signed delivery jaa rahi hai.
//
// Merchant apni taraf SE ye verify kare:
//   HMAC_SHA256(rawBody, webhookSecret) === X-Youpi-Signature (without "sha256=")
// Aur X-Youpi-Delivery-Id ko unique store kare (duplicate delivery ka bachav).

import { createHmac, randomUUID } from "node:crypto";
import type { Db, DeliveryRow, OrderWithItems, SessionRow } from "../../config/db";
import type { MerchantRow } from "../../config/db";

export interface MerchantWebhookDeps {
  db: Db;
  now?: () => Date;
  /** Test me inject hota hai (asli network call nahi). */
  http?: typeof fetch;
  maxAttempts?: number;
}

/** Retry backoff (seconds) — pehla attempt turant. */
export const RETRY_BACKOFF_SECONDS = [0, 30, 120, 600, 1800];

export function signPayload(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

export function buildPaymentSuccessPayload(input: {
  session: SessionRow;
  order: OrderWithItems;
  utr: string;
  at: Date;
}): Record<string, unknown> {
  return {
    event: "payment.success",
    paymentId: input.session.id,
    orderId: input.order.id,
    orderNumber: input.order.number,
    amountPaise: input.session.amountPaise,
    currency: input.session.currency,
    method: input.session.method ?? "upi",
    utr: input.utr,
    reference: input.session.reference,
    vpa: input.session.vpa,
    senderVpa: input.session.senderVpa,
    completedAt: input.at.toISOString(),
    metadata: { source: "youpi-selfhosted-gateway", items: input.order.items.length },
  };
}

export function createMerchantWebhookService({ db, now = () => new Date(), http = fetch, maxAttempts = 5 }: MerchantWebhookDeps) {
  async function attempt(delivery: DeliveryRow): Promise<void> {
    const attemptNumber = delivery.attempts + 1;
    const rawBody = JSON.stringify(delivery.payload);
    const secret = await secretFor(delivery.merchantId);

    if (!secret) {
      await db.recordDeliveryAttempt(delivery.id, {
        delivered: false,
        failed: true,
        statusCode: null,
        error: "MERCHANT_WEBHOOK_SECRET_MISSING",
        nextAttemptAt: now(),
        attempt: attemptNumber,
      });
      return;
    }

    try {
      const response = await http(delivery.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-youpi-event": String((delivery.payload as { event?: string }).event ?? "payment.success"),
          "x-youpi-delivery-id": delivery.deliveryId,
          "x-youpi-timestamp": String(Math.floor(now().getTime() / 1000)),
          "x-youpi-signature": signPayload(rawBody, secret),
        },
        body: rawBody,
        signal: AbortSignal.timeout(8000),
      });

      const delivered = response.status >= 200 && response.status < 300;
      if (delivered) {
        await db.recordDeliveryAttempt(delivery.id, {
          delivered: true,
          statusCode: response.status,
          error: null,
          nextAttemptAt: now(),
          attempt: attemptNumber,
        });
        return;
      }

      await scheduleRetry(delivery, attemptNumber, `HTTP_${response.status}`, response.status);
    } catch (error) {
      await scheduleRetry(delivery, attemptNumber, (error as Error).message.slice(0, 200), null);
    }
  }

  async function scheduleRetry(
    delivery: DeliveryRow,
    attemptNumber: number,
    error: string,
    statusCode: number | null,
  ): Promise<void> {
    const exhausted = attemptNumber >= maxAttempts;
    const backoff = RETRY_BACKOFF_SECONDS[Math.min(attemptNumber, RETRY_BACKOFF_SECONDS.length - 1)] ?? 1800;
    await db.recordDeliveryAttempt(delivery.id, {
      delivered: false,
      failed: exhausted,
      statusCode,
      error: exhausted ? `${error} (retries exhausted)` : error,
      nextAttemptAt: new Date(now().getTime() + backoff * 1000),
      attempt: attemptNumber,
    });
  }

  async function secretFor(merchantId: string): Promise<string | null> {
    const merchant = await db.getMerchant();
    if (!merchant || merchant.id !== merchantId) return null;
    return merchant.webhookSecret;
  }

  return {
    /**
     * Session settle hone par bulao. Delivery row banti hai (audit), phir turant
     * ek attempt jaata hai. Failure par retry scheduler sambhalta hai.
     */
    async dispatch(input: { session: SessionRow; order: OrderWithItems; merchant: MerchantRow; utr: string }): Promise<DeliveryRow | null> {
      if (!input.merchant.webhookUrl) return null;

      const payload = buildPaymentSuccessPayload({
        session: input.session,
        order: input.order,
        utr: input.utr,
        at: now(),
      });

      const delivery = await db.createDelivery({
        merchantId: input.merchant.id,
        event: "payment.success",
        paymentId: input.session.id,
        orderId: input.order.id,
        deliveryId: `dlv_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
        url: input.merchant.webhookUrl,
        payload,
        nextAttemptAt: now(),
      });

      await attempt(delivery).catch(() => {
        // Attempt log already DB me hai — dispatcher kabhi throw nahi karta,
        // warna payment settle hone ka flow ruk jayega.
      });
      return delivery;
    },

    /** Scheduler: due deliveries (retry) bhejo. */
    async processDue(limit = 25): Promise<{ processed: number }> {
      const due = await db.dueDeliveries(now(), limit);
      for (const delivery of due) {
        await attempt(delivery);
      }
      return { processed: due.length };
    },

    /** Manual replay (admin) — specific delivery turant dobara bhejo. */
    async replay(delivery: DeliveryRow): Promise<void> {
      await attempt(delivery);
    },
  };
}

export type MerchantWebhookService = ReturnType<typeof createMerchantWebhookService>;
