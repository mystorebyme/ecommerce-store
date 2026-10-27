// Purpose: Har payment try ka alag record (order + provider QR id)
//
// Ek order par buyer 3 baar try kar sakta hai (QR expire ho gaya, card fail hua...).
// Har try = naya `Payment` row + **naya single-use QR**. Isliye amount se match nahi
// karte — attempt id / provider qr id se match karte hain (ADR-0010).
//
// Ye file sirf attempt lifecycle ke DB operations rakhti hai. Decision lena
// (kaunsa status kab) payments.service ka kaam hai.

import type { Db, PaymentRow, PaymentStatus } from "../../config/db";

export interface AttemptDeps {
  db: Db;
  now?: () => Date;
}

export function createPaymentAttemptsService({ db, now = () => new Date() }: AttemptDeps) {
  return {
    findByKey(idempotencyKey: string): Promise<PaymentRow | null> {
      return db.findPaymentByIdempotencyKey(idempotencyKey);
    },

    findById(paymentId: string): Promise<PaymentRow | null> {
      return db.findPaymentById(paymentId);
    },

    async markPaid(
      payment: PaymentRow,
      paid: { providerPaymentId: string; utr: string | null; method: string | null; capturedAt: Date | null },
    ): Promise<void> {
      await db.markPaymentPaid(payment.id, {
        providerPaymentId: paid.providerPaymentId,
        utr: paid.utr,
        method: paid.method,
        paidAt: paid.capturedAt ?? now(),
      });
      await db.setOrderStatus(payment.orderId, "PAID");
    },

    async markStatus(paymentId: string, status: PaymentStatus, failureReason?: string | null): Promise<void> {
      await db.setPaymentStatus(paymentId, status, { failureReason: failureReason ?? null });
    },

    /** Expiry: QR close karo (best effort) aur attempt ko EXPIRED karo. */
    async expire(payment: PaymentRow, closeQr?: (qrId: string) => Promise<void>): Promise<void> {
      if (payment.providerQrId && closeQr) {
        try {
          await closeQr(payment.providerQrId);
        } catch {
          // Provider ne pehle hi close kar diya hoga — expiry ka faisla DB se hi hai.
        }
      }
      await db.setPaymentStatus(payment.id, "EXPIRED");
    },

    isExpired(payment: PaymentRow): boolean {
      return payment.status === "CREATED" || payment.status === "PENDING"
        ? payment.expiresAt.getTime() <= now().getTime()
        : false;
    },
  };
}
