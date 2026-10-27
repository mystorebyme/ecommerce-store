// Purpose: payments: Business logic
//
// Poora asli flow yahin decide hota hai:
//   1. intent      → order DB se load, amount server se, provider order + single-use UPI QR
//   2. status      → buyer poll karta hai; server provider se bhi verify karta hai (safety net)
//   3. checkout    → browser ke signature ko HMAC se verify, phir provider se payment fetch
//   4. webhook     → amount/order match hone par hi PAID (raw body + signature pehle hi verify)
//   5. refund      → sirf PAID payment par, partial allowed
//
// Critical rule #5: browser redirect/response se order paid nahi hota.
// Status sirf verified webhook ya server-side provider lookup se badalta hai.

import type { Db, OrderRow, PaymentRow } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { isValidChargeAmount, sumPaise } from "../../utils/money";
import { createPaymentAttemptsService } from "./payment-attempts.service";
import type { PaymentProvider, ProviderPayment } from "./providers/provider.interface";

export interface PaymentsConfig {
  /** Razorpay checkout.js ko public key chahiye (secret kabhi client ko nahi). */
  providerKeyId: string;
  providerName: string;
  ttlSeconds: number;
  webBaseUrl: string;
}

export interface PaymentsDeps {
  db: Db;
  provider: PaymentProvider;
  config: PaymentsConfig;
  now?: () => Date;
  /** Paid hone par side-effects (email/WhatsApp/invoice) — production me BullMQ queue. */
  onPaid?: (payment: PaymentRow) => Promise<void> | void;
}

export interface PaymentIntentView {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amountPaise: number;
  currency: string;
  status: PaymentRow["status"];
  expiresAt: string;
  provider: { name: string; keyId: string };
  /** Buyer ko dikhane ke liye QR. */
  qr: { id: string | null; imageUrl: string | null; qrString: string | null };
  /** Razorpay Checkout (card/netbanking/UPI app) ke liye ready options. */
  checkout: {
    key: string;
    orderId: string;
    amountPaise: number;
    currency: string;
    name: string;
    description: string;
    prefill: { name: string; contact: string };
    notes: { paymentId: string; orderId: string };
  };
}

export function createPaymentsService(deps: PaymentsDeps) {
  const { db, provider, config } = deps;
  const now = deps.now ?? (() => new Date());
  const attempts = createPaymentAttemptsService({ db, now });

  function toView(payment: PaymentRow, order: OrderRow): PaymentIntentView {
    return {
      paymentId: payment.id,
      orderId: order.id,
      orderNumber: order.number,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      status: payment.status,
      expiresAt: payment.expiresAt.toISOString(),
      provider: { name: payment.provider, keyId: config.providerKeyId },
      qr: { id: payment.providerQrId, imageUrl: payment.qrImageUrl, qrString: payment.qrString },
      checkout: {
        key: config.providerKeyId,
        orderId: payment.providerOrderId,
        amountPaise: payment.amountPaise,
        currency: payment.currency,
        name: "Demo Store",
        description: `Order ${order.number}`,
        prefill: { name: order.customerName, contact: `+91${order.customerPhone}` },
        notes: { paymentId: payment.id, orderId: order.id },
      },
    };
  }

  async function loadOrder(orderId: string): Promise<OrderRow> {
    const order = await db.findOrderById(orderId);
    if (!order) throw AppError.notFound("ORDER_NOT_FOUND", "Order nahi mila.");
    return order;
  }

  async function loadPayment(paymentId: string): Promise<PaymentRow> {
    const payment = await db.findPaymentById(paymentId);
    if (!payment) throw AppError.notFound("PAYMENT_NOT_FOUND", "Payment attempt nahi mila.");
    return payment;
  }

  /** Amount match karta hai? Nahi to paisa mark nahi hota. */
  function assertAmountMatches(payment: PaymentRow, providerPayment: ProviderPayment): void {
    if (providerPayment.amountPaise !== payment.amountPaise) {
      throw AppError.conflict(
        "ORDER_AMOUNT_MISMATCH",
        `Provider amount ${providerPayment.amountPaise} paise hai, order ${payment.amountPaise} paise — payment verify nahi hui.`,
      );
    }
  }

  async function settlePaid(payment: PaymentRow, providerPayment: ProviderPayment): Promise<void> {
    if (payment.status === "PAID") return; // already settled (idempotent)
    assertAmountMatches(payment, providerPayment);
    await attempts.markPaid(payment, {
      providerPaymentId: providerPayment.id,
      utr: providerPayment.utr,
      method: providerPayment.method,
      capturedAt: providerPayment.capturedAt,
    });
    const fresh = await db.findPaymentById(payment.id);
    if (fresh && deps.onPaid) await deps.onPaid(fresh);
  }

  return {
    /** POST /payments/intents — naya attempt + naya single-use QR. */
    async createIntent(input: { orderId: string; idempotencyKey: string }): Promise<PaymentIntentView> {
      const replay = await attempts.findByKey(input.idempotencyKey);
      if (replay) return toView(replay, await loadOrder(replay.orderId));

      const order = await loadOrder(input.orderId);
      if (order.status !== "PENDING_PAYMENT") {
        throw AppError.conflict("ORDER_NOT_PAYABLE", `Order ${order.number} ka status ${order.status} hai.`);
      }
      if (!isValidChargeAmount(order.amountPaise)) {
        throw AppError.unprocessable(
          "AMOUNT_OUT_OF_RANGE",
          "UPI payment ₹1 se ₹5,00,000 ke beech hi ho sakta hai.",
        );
      }

      const expiresAt = new Date(now().getTime() + config.ttlSeconds * 1000);

      // 1. Provider order (receipt = hamara order number, dashboard me searchable).
      const providerOrder = await provider.createOrder({
        amountPaise: order.amountPaise,
        currency: order.currency,
        receipt: order.number,
        notes: { orderId: order.id, orderNumber: order.number },
      });

      const payment = await db.createPayment({
        orderId: order.id,
        provider: provider.name,
        providerOrderId: providerOrder.id,
        amountPaise: order.amountPaise,
        currency: order.currency,
        idempotencyKey: input.idempotencyKey,
        expiresAt,
      });

      // 2. Per-order single-use QR (fixed amount, close_by = expiry).
      try {
        const qr = await provider.createQr({
          providerOrderId: providerOrder.id,
          amountPaise: payment.amountPaise,
          description: `Order ${order.number}`,
          expiresAt,
          notes: { paymentId: payment.id, orderId: order.id },
        });
        await db.attachQr(payment.id, { qrId: qr.id, qrString: qr.qrString, qrImageUrl: qr.imageUrl });
      } catch (error) {
        // QR fail hua to attempt FAILED — naya intent maangna padega.
        await attempts.markStatus(payment.id, "FAILED", "QR_CREATE_FAILED");
        throw error;
      }

      const fresh = await loadPayment(payment.id);
      return toView(fresh, order);
    },

    /** GET /payments/:id — buyer poll karta hai; server provider se bhi confirm karta hai. */
    async getStatus(input: { paymentId: string }): Promise<PaymentIntentView> {
      let payment = await loadPayment(input.paymentId);
      const order = await loadOrder(payment.orderId);

      if (attempts.isExpired(payment)) {
        await attempts.expire(payment, (qrId) => provider.closeQr(qrId));
        payment = await loadPayment(payment.id);
        return toView(payment, order);
      }

      // Safety net: webhook miss ho gaya ho to QR par aayi payment server se poochho.
      if (payment.status === "PENDING" && payment.providerQrId) {
        const qrPayments = await provider.listQrPayments(payment.providerQrId);
        const captured = qrPayments.find((p) => p.status === "captured" && p.amountPaise === payment.amountPaise);
        if (captured) {
          await settlePaid(payment, captured);
          payment = await loadPayment(payment.id);
        }
      }

      return toView(payment, order);
    },

    /**
     * POST /payments/:id/verify — Razorpay Checkout (card/UPI app) ke response ke liye.
     * Signature HMAC-SHA256(order_id|payment_id, key_secret) se verify hoti hai.
     */
    async verifyCheckout(input: {
      paymentId: string;
      providerOrderId: string;
      providerPaymentId: string;
      signature: string | null;
    }): Promise<PaymentIntentView> {
      const payment = await loadPayment(input.paymentId);
      const order = await loadOrder(payment.orderId);

      if (payment.providerOrderId !== input.providerOrderId) {
        throw AppError.badRequest("ORDER_MISMATCH", "Ye payment is order ka nahi hai.");
      }
      const valid = provider.verifyCheckoutSignature({
        providerOrderId: input.providerOrderId,
        providerPaymentId: input.providerPaymentId,
        signature: input.signature,
      });
      if (!valid) {
        throw AppError.unauthorized("SIGNATURE_INVALID", "Checkout signature verify nahi hui.");
      }

      // Signature sahi hai — phir bhi source of truth provider API hi hai.
      const providerPayment = await provider.fetchPayment(input.providerPaymentId);
      if (providerPayment.status !== "captured") {
        throw AppError.conflict("PAYMENT_NOT_CAPTURED", `Payment status abhi ${providerPayment.status} hai.`);
      }
      await settlePaid(payment, providerPayment);
      return toView((await loadPayment(payment.id)), order);
    },

    /** Webhook se aane wala asli settlement — sirf verified caller isse call karta hai. */
    async settleFromProviderPayment(providerPayment: ProviderPayment, providerOrderId: string): Promise<void> {
      const payment = await db.findPaymentByProviderOrderId(providerOrderId);
      if (!payment) return; // hamara attempt nahi (dusre system ka order?) — ignore
      await settlePaid(payment, providerPayment);
    },

    /** payment.failed webhook. */
    async markFailedByProviderOrderId(providerOrderId: string, reason: string | null): Promise<void> {
      const payment = await db.findPaymentByProviderOrderId(providerOrderId);
      if (!payment || payment.status === "PAID") return;
      await attempts.markStatus(payment.id, "FAILED", reason);
    },

    /** qr_code.closed — buyer ne pay nahi kiya aur QR band ho gaya. */
    async markExpiredByQrId(qrId: string): Promise<void> {
      const payment = await findPaymentByQrId(db, qrId);
      if (!payment || payment.status === "PAID") return;
      await attempts.markStatus(payment.id, "EXPIRED", "QR_CLOSED");
    },

    /** POST /payments/:id/refund — sirf PAID par, partial allowed. */
    async refund(input: { paymentId: string; amountPaise?: number }): Promise<{
      paymentId: string;
      refundedPaise: number;
      status: PaymentRow["status"];
      providerRefundId: string;
    }> {
      const payment = await loadPayment(input.paymentId);
      if (payment.status !== "PAID" && payment.status !== "PARTIALLY_REFUNDED") {
        throw AppError.conflict("PAYMENT_NOT_REFUNDABLE", `Payment status ${payment.status} hai.`);
      }
      if (!payment.providerPaymentId) {
        throw AppError.conflict("PAYMENT_NOT_REFUNDABLE", "Provider payment id missing.");
      }

      const alreadyRefunded = payment.refundedPaise;
      const requested = input.amountPaise ?? payment.amountPaise - alreadyRefunded;
      const totalAfter = sumPaise([alreadyRefunded, requested]);
      if (totalAfter > payment.amountPaise) {
        throw AppError.unprocessable(
          "REFUND_EXCEEDS_PAID",
          "Refund amount paid amount se zyada nahi ho sakta.",
        );
      }

      const refund = await provider.refund({
        providerPaymentId: payment.providerPaymentId,
        amountPaise: requested,
        notes: { paymentId: payment.id, reason: "merchant_refund" },
      });

      const status = totalAfter === payment.amountPaise ? "REFUNDED" : "PARTIALLY_REFUNDED";
      await db.recordRefund(payment.id, { refundPaise: totalAfter, status });
      if (status === "REFUNDED") await db.setOrderStatus(payment.orderId, "REFUNDED");

      return { paymentId: payment.id, refundedPaise: totalAfter, status, providerRefundId: refund.id };
    },

    /** Scheduler: expire hone wale attempts band karo (auto-expiry par webhook nahi aata). */
    async expireStale(): Promise<number> {
      return db.expireStalePayments(now());
    },
  };
}

async function findPaymentByQrId(db: Db, qrId: string): Promise<PaymentRow | null> {
  // Webhook me sirf provider ka qr id aata hai, isliye qr-id se attempt dhoondhte hain.
  return db.findPaymentByQrId(qrId);
}
