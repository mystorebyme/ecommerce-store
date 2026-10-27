// Purpose: Test data — fake payment provider
//
// `PaymentProvider` interface ka deterministic implementation. Isse tests me
// Razorpay ka network call nahi jaata, par signature verification asli HMAC se
// hi hoti hai (taaki webhook tests ka matlab bana rahe).

import { createHmac } from "node:crypto";
import type {
  CreateOrderInput,
  CreateQrInput,
  PaymentProvider,
  ProviderOrder,
  ProviderPayment,
  ProviderQr,
  ProviderRefund,
} from "../../apps/api/src/modules/payments/providers/provider.interface";

export interface FakeProvider extends PaymentProvider {
  calls: { createOrder: number; createQr: number; closeQr: number; refund: number; fetchPayment: number };
  /** GET /qr-codes/:id/payments ka jawab — test isse set karta hai. */
  setQrPayments(payments: ProviderPayment[]): void;
  setPayment(payment: ProviderPayment): void;
  failNextQr(error: Error): void;
  lastQrInput?: CreateQrInput;
}

export const TEST_KEY_ID = "rzp_test_keyid";
export const TEST_KEY_SECRET = "test_key_secret";
export const TEST_WEBHOOK_SECRET = "test_webhook_secret";

export function signWebhook(rawBody: string, secret = TEST_WEBHOOK_SECRET): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function signCheckout(providerOrderId: string, providerPaymentId: string, secret = TEST_KEY_SECRET): string {
  return createHmac("sha256", secret).update(`${providerOrderId}|${providerPaymentId}`).digest("hex");
}

export function createFakeProvider(): FakeProvider {
  let counter = 0;
  let qrPayments: ProviderPayment[] = [];
  let payment: ProviderPayment | null = null;
  let qrFailure: Error | null = null;

  const api: FakeProvider = {
    name: "razorpay",
    calls: { createOrder: 0, createQr: 0, closeQr: 0, refund: 0, fetchPayment: 0 },
    lastQrInput: undefined,

    setQrPayments(next) {
      qrPayments = next;
    },
    setPayment(next) {
      payment = next;
    },
    failNextQr(error) {
      qrFailure = error;
    },

    async createOrder(input: CreateOrderInput): Promise<ProviderOrder> {
      api.calls.createOrder += 1;
      counter += 1;
      return {
        id: `order_TEST${counter}`,
        amountPaise: input.amountPaise,
        currency: input.currency,
        status: "created",
      };
    },

    async createQr(input: CreateQrInput): Promise<ProviderQr> {
      api.calls.createQr += 1;
      api.lastQrInput = input;
      if (qrFailure) {
        const error = qrFailure;
        qrFailure = null;
        throw error;
      }
      counter += 1;
      return {
        id: `qr_TEST${counter}`,
        imageUrl: `https://rzp.test/qr/${counter}.png`,
        qrString: `upi://pay?pa=demo@okhdfcbank&pn=Demo%20Store&am=${(input.amountPaise / 100).toFixed(2)}&cu=INR`,
        closesAt: input.expiresAt,
      };
    },

    async closeQr(): Promise<void> {
      api.calls.closeQr += 1;
    },

    async listQrPayments(): Promise<ProviderPayment[]> {
      return qrPayments;
    },

    async fetchPayment(): Promise<ProviderPayment> {
      api.calls.fetchPayment += 1;
      if (!payment) throw new Error("fake provider: payment not set");
      return payment;
    },

    async refund(input): Promise<ProviderRefund> {
      api.calls.refund += 1;
      counter += 1;
      return {
        id: `rfnd_TEST${counter}`,
        providerPaymentId: input.providerPaymentId,
        amountPaise: input.amountPaise,
        status: "processed",
      };
    },

    verifyWebhookSignature({ rawBody, signature }) {
      if (!signature) return false;
      return signWebhook(rawBody.toString()) === signature;
    },

    verifyCheckoutSignature({ providerOrderId, providerPaymentId, signature }) {
      if (!signature) return false;
      return signCheckout(providerOrderId, providerPaymentId) === signature;
    },
  };

  return api;
}

/** Ready-made captured UPI payment (test me repeat hota hai). */
export function capturedUpiPayment(overrides: Partial<ProviderPayment> = {}): ProviderPayment {
  return {
    id: "pay_TEST123",
    orderId: "order_TEST1",
    status: "captured",
    amountPaise: 49900,
    method: "upi",
    utr: "412345678901",
    capturedAt: new Date("2026-10-28T10:00:00.000Z"),
    ...overrides,
  };
}
