// Purpose: Razorpay implementation
//
// Yahan sirf 4 cheezein hoti hain: order banao, per-order UPI QR banao, payment/refund
// fetch karo, aur signature verify karo. Koi business logic nahi — wo payments.service me hai.
//
// Docs: https://razorpay.com/docs/api/orders/ , /qr-codes/ , /payments/ , /webhooks/

import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../../../middlewares/error.middleware";
import type {
  CreateOrderInput,
  CreateQrInput,
  PaymentProvider,
  ProviderOrder,
  ProviderPayment,
  ProviderQr,
  ProviderRefund,
} from "./provider.interface";

const API_BASE = "https://api.razorpay.com/v1";
const TIMEOUT_MS = 12_000;

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  /** Test hook: tests me fetch inject karte hain (asli network call nahi). */
  fetchImpl?: typeof fetch;
}

export function createRazorpayProvider(config: RazorpayConfig): PaymentProvider {
  const http = config.fetchImpl ?? fetch;
  const auth = `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;

  async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await http(`${API_BASE}${path}`, {
        method,
        headers: {
          authorization: auth,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      // Network/timeout: buyer ko "try again" dikhana hai, 500 stack nahi.
      throw AppError.unavailable(
        "PROVIDER_UNREACHABLE",
        `Razorpay se connect nahi ho paya (${(error as Error).message}).`,
      );
    }

    const text = await response.text();
    const json = text ? (JSON.parse(text) as unknown) : {};

    if (!response.ok) {
      const described = (json as { error?: { description?: string; code?: string } }).error;
      throw AppError.unavailable(
        "PROVIDER_ERROR",
        described?.description ?? `Razorpay ${response.status} error`,
        { code: described?.code, status: response.status },
      );
    }
    return json as T;
  }

  return {
    name: "razorpay",

    async createOrder(input: CreateOrderInput): Promise<ProviderOrder> {
      const order = await call<{ id: string; amount: number; currency: string; status: string }>(
        "POST",
        "/orders",
        {
          amount: input.amountPaise, // Razorpay bhi paise leta hai — conversion nahi
          currency: input.currency,
          receipt: input.receipt,
          notes: input.notes,
          payment_capture: 1,
        },
      );
      return { id: order.id, amountPaise: order.amount, currency: order.currency, status: order.status };
    },

    async createQr(input: CreateQrInput): Promise<ProviderQr> {
      const qr = await call<{ id: string; image_url?: string; qr_string?: string; close_by?: number }>(
        "POST",
        "/qr-codes",
        {
          type: "upi_qr",
          name: "Demo Store",
          usage: "single_use", // ek QR = ek payment attempt (ADR-0010)
          fixed_amount: true,
          payment_amount: input.amountPaise,
          description: input.description,
          close_by: Math.floor(input.expiresAt.getTime() / 1000),
          notes: { ...input.notes, provider_order_id: input.providerOrderId },
        },
      );
      return {
        id: qr.id,
        imageUrl: qr.image_url ?? null,
        qrString: qr.qr_string ?? null,
        closesAt: qr.close_by ? new Date(qr.close_by * 1000) : null,
      };
    },

    async closeQr(qrId: string): Promise<void> {
      await call<unknown>("POST", `/qr-codes/${qrId}/close`);
    },

    async listQrPayments(qrId: string): Promise<ProviderPayment[]> {
      const result = await call<{ payments?: RzpPayment[] }>("GET", `/qr-codes/${qrId}/payments`);
      return (result.payments ?? []).map(mapPayment);
    },

    async fetchPayment(providerPaymentId: string): Promise<ProviderPayment> {
      return mapPayment(await call<RzpPayment>("GET", `/payments/${providerPaymentId}`));
    },

    async refund(input): Promise<ProviderRefund> {
      const refund = await call<{ id: string; payment_id: string; amount: number; status: string }>(
        "POST",
        `/payments/${input.providerPaymentId}/refund`,
        { amount: input.amountPaise, notes: input.notes, speed: "normal" },
      );
      return {
        id: refund.id,
        providerPaymentId: refund.payment_id,
        amountPaise: refund.amount,
        status: refund.status,
      };
    },

    verifyWebhookSignature({ rawBody, signature }): boolean {
      if (!signature || !config.webhookSecret) return false;
      const expected = createHmac("sha256", config.webhookSecret).update(rawBody).digest("hex");
      return safeEqual(expected, signature);
    },

    verifyCheckoutSignature({ providerOrderId, providerPaymentId, signature }): boolean {
      if (!signature) return false;
      const expected = createHmac("sha256", config.keySecret)
        .update(`${providerOrderId}|${providerPaymentId}`)
        .digest("hex");
      return safeEqual(expected, signature);
    },
  };
}

/** Length-safe compare — timing attack se bachne ke liye. */
function safeEqual(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface RzpPayment {
  id: string;
  order_id: string | null;
  status: ProviderPayment["status"];
  amount: number;
  method?: string | null;
  captured_at?: number | null;
  acquirer_data?: { upi_transaction_id?: string; rrn?: string; upi_transaction_id_2?: string };
}

function mapPayment(payment: RzpPayment): ProviderPayment {
  const utr =
    payment.acquirer_data?.upi_transaction_id ?? payment.acquirer_data?.rrn ?? payment.acquirer_data?.upi_transaction_id_2 ?? null;
  return {
    id: payment.id,
    orderId: payment.order_id ?? null,
    status: payment.status,
    amountPaise: payment.amount,
    method: payment.method ?? null,
    utr,
    capturedAt: payment.captured_at ? new Date(payment.captured_at * 1000) : null,
  };
}
