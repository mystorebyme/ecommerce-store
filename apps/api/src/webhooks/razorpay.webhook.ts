// Purpose: Razorpay: signature verify (webhook secret), x-razorpay-event-id dedupe, queue
//
// Ye route `express.raw()` par mount hota hai (JSON parse se PEHLE), kyunki signature
// **raw body** par banti hai. Rule #4 yaad rakho:
//   1. signature verify (webhook secret — key secret NAHI)
//   2. x-razorpay-event-id ko DB me unique save → duplicate delivery ignore
//   3. turant 2xx do, asli kaam queue/worker me (yahan demo ke liye inline hai)
//   4. payment sirf yahan ya server-side verify se PAID hota hai — browser se kabhi nahi

import type { Request, Response } from "express";
import type { Db } from "../config/db";
import { AppError } from "../middlewares/error.middleware";
import type { createPaymentsService } from "../modules/payments/payments.service";
import type { PaymentProvider, ProviderPayment } from "../modules/payments/providers/provider.interface";

export interface RazorpayWebhookDeps {
  db: Db;
  provider: PaymentProvider;
  payments: ReturnType<typeof createPaymentsService>;
}

interface RazorpayEvent {
  event: string;
  payload: {
    payment?: { entity?: RzpPaymentEntity };
    qr_code?: { entity?: { id: string; status: string; payment_amount?: number } };
  };
}

interface RzpPaymentEntity {
  id: string;
  order_id?: string | null;
  status: ProviderPayment["status"];
  amount: number;
  method?: string | null;
  captured_at?: number | null;
  error_description?: string | null;
  acquirer_data?: { upi_transaction_id?: string; rrn?: string };
}

export function createRazorpayWebhook({ db, provider, payments }: RazorpayWebhookDeps) {
  /** Raw body + header se event nikaalo — invalid ho to 401 (provider retry karega). */
  function verify(req: Request): RazorpayEvent {
    const signature = req.header("x-razorpay-signature") ?? null;
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw AppError.badRequest("RAW_BODY_MISSING", "Webhook raw body missing — express.raw() mount check karo.");
    }
    if (!provider.verifyWebhookSignature({ rawBody, signature })) {
      throw AppError.unauthorized("WEBHOOK_SIGNATURE_INVALID", "Webhook signature verify nahi hui.");
    }
    try {
      return JSON.parse(rawBody.toString("utf8")) as RazorpayEvent;
    } catch {
      throw AppError.badRequest("WEBHOOK_MALFORMED", "Webhook body valid JSON nahi hai.");
    }
  }

  return async function handleRazorpayWebhook(req: Request, res: Response): Promise<void> {
    const event = verify(req);

    const eventId = req.header("x-razorpay-event-id");
    if (!eventId) {
      // Dedupe ke bina replay attack ka dar — par webhook drop bhi nahi karte.
      req.log?.info?.({ event: event.event }, "webhook_missing_event_id");
    }

    // 1. Dedupe: pehle hi aa chuka hai to 200 (provider ko dobara retry karne ki zarurat nahi).
    const dedupeId = eventId ?? `${event.event}:${event.payload.payment?.entity?.id ?? "unknown"}`;
    const inserted = await db.insertWebhookEvent({
      provider: "razorpay",
      eventId: dedupeId,
      eventType: event.event,
      payload: event,
    });
    if (!inserted.inserted) {
      res.status(200).json({ status: "duplicate" });
      return;
    }

    try {
      const result = await processEvent(event);
      await db.markWebhookEvent(inserted.id, result === "handled" ? "PROCESSED" : "IGNORED");
      res.status(200).json({ status: result });
    } catch (error) {
      await db.markWebhookEvent(
        inserted.id,
        "FAILED",
        error instanceof Error ? error.message : "unknown error",
      );
      // Non-2xx => Razorpay retry karega; par yahan hamara dedupe usi event ko dobara
      // process hone se rokta hai, isliye FAILED event ko DLQ/alert me daalna chahiye.
      throw error;
    }
  };

  async function processEvent(event: RazorpayEvent): Promise<"handled" | "ignored"> {
    switch (event.event) {
      // UPI QR par paisa aaya, ya order paid hua — dono me payment entity aati hai.
      case "payment.captured":
      case "order.paid":
      case "qr_code.credited": {
        const entity = event.payload.payment?.entity;
        if (!entity?.order_id) return "ignored";
        const providerPayment: ProviderPayment = {
          id: entity.id,
          orderId: entity.order_id,
          status: entity.status,
          amountPaise: entity.amount,
          method: entity.method ?? null,
          utr: entity.acquirer_data?.upi_transaction_id ?? entity.acquirer_data?.rrn ?? null,
          capturedAt: entity.captured_at ? new Date(entity.captured_at * 1000) : new Date(),
        };
        await payments.settleFromProviderPayment(providerPayment, entity.order_id);
        return "handled";
      }

      case "payment.failed": {
        const entity = event.payload.payment?.entity;
        if (!entity?.order_id) return "ignored";
        await payments.markFailedByProviderOrderId(entity.order_id, entity.error_description ?? "PAYMENT_FAILED");
        return "handled";
      }

      case "qr_code.closed": {
        const qr = event.payload.qr_code?.entity;
        if (!qr?.id) return "ignored";
        await payments.markExpiredByQrId(qr.id);
        return "handled";
      }

      default:
        // Baaki events (refund.*, settlement.*) abhi ignore — future me yahan handle honge.
        return "ignored";
    }
  }
}
