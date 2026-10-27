// Purpose: Payment provider adapter interface (gateway badalna aasan)
//
// Payments module sirf is interface se baat karta hai. Aaj Razorpay hai; kal
// Cashfree/PayU aaye to naya adapter likho, service code chhua bhi na jaaye.
//
// Sab amount **integer paise** me — provider ke rupees kabhi yahan nahi aate.

export interface ProviderOrder {
  id: string;
  amountPaise: number;
  currency: string;
  status: string;
}

export interface ProviderQr {
  id: string;
  /** Provider-hosted QR image (buyer ko dikhane ke liye). */
  imageUrl: string | null;
  /** Agar provider `upi://pay?...` string deta hai to yahan, warna null. */
  qrString: string | null;
  closesAt: Date | null;
}

export interface ProviderPayment {
  id: string;
  orderId: string | null;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  amountPaise: number;
  method: string | null;
  /** UPI UTR / RRN — bank reconciliation ke liye. */
  utr: string | null;
  capturedAt: Date | null;
}

export interface ProviderRefund {
  id: string;
  providerPaymentId: string;
  amountPaise: number;
  status: string;
}

export interface CreateOrderInput {
  amountPaise: number;
  currency: string;
  /** Hamara order number — provider dashboard me isi se search hota hai. */
  receipt: string;
  notes: Record<string, string>;
}

export interface CreateQrInput {
  providerOrderId: string;
  amountPaise: number;
  description: string;
  expiresAt: Date;
  notes: Record<string, string>;
}

export interface PaymentProvider {
  readonly name: string;

  createOrder(input: CreateOrderInput): Promise<ProviderOrder>;
  /** Per-order single-use QR (ADR-0010) — fixed amount, ek hi baar scan. */
  createQr(input: CreateQrInput): Promise<ProviderQr>;
  closeQr(qrId: string): Promise<void>;
  /** Missed webhook ke liye safety net: QR par aayi payments server se poochho. */
  listQrPayments(qrId: string): Promise<ProviderPayment[]>;
  fetchPayment(providerPaymentId: string): Promise<ProviderPayment>;
  refund(input: { providerPaymentId: string; amountPaise: number; notes: Record<string, string> }): Promise<ProviderRefund>;

  /** Webhook: raw body + `x-razorpay-signature` (webhook secret se HMAC). */
  verifyWebhookSignature(input: { rawBody: Buffer | string; signature: string | null }): boolean;
  /** Checkout response: order_id|payment_id ka HMAC (key secret se). */
  verifyCheckoutSignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string | null;
  }): boolean;
}
