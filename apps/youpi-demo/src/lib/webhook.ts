import { gatewaySignature } from "./hmac";
import { randomId, randomUtr } from "./format";
import type { Session, Settings, WebhookDelivery } from "./types";

export interface WebhookPayloadShape {
  event: "SUCCESS" | "REFUNDED" | "FAILED";
  paymentId: string;
  orderId: string;
  amount: string;
  amountPaise: number;
  currency: "INR";
  method: string;
  utr: string;
  completedAt: string;
  deliveryId: string;
  timestamp: number;
  verificationLevel: string;
  metadata: Record<string, string>;
}

export function buildPayload(
  event: WebhookPayloadShape["event"],
  session: Session,
  extra: { deliveryId: string; timestamp: number; utr?: string; level?: string },
): WebhookPayloadShape {
  return {
    event,
    paymentId: session.id,
    orderId: session.orderId,
    amount: (session.amountPaise / 100).toFixed(2),
    amountPaise: session.amountPaise,
    currency: "INR",
    method: session.method === "UPI" ? "UPI" : session.method,
    utr: extra.utr ?? session.utr ?? randomUtr(),
    completedAt: new Date(extra.timestamp).toISOString(),
    deliveryId: extra.deliveryId,
    timestamp: extra.timestamp,
    verificationLevel: extra.level ?? "observer-signal",
    metadata: {
      source: session.source,
      note: session.note ?? "demo order",
    },
  };
}

export function makeDelivery(
  event: WebhookDelivery["event"],
  session: Session,
  settings: Settings,
  opts: { timestamp?: number; utr?: string; status?: WebhookDelivery["status"] } = {},
): WebhookDelivery {
  const timestamp = opts.timestamp ?? Date.now();
  const deliveryId = randomId("dlv", 10);
  const payload = buildPayload(event, session, { deliveryId, timestamp, utr: opts.utr });
  const raw = JSON.stringify(payload);
  return {
    id: randomId("wh", 8),
    deliveryId,
    event,
    orderId: session.orderId,
    sessionId: session.id,
    amountPaise: session.amountPaise,
    utr: payload.utr,
    signature: gatewaySignature(settings.webhookSecret, raw),
    timestamp,
    status: opts.status ?? "delivered",
    attempts: 1,
    payload: raw,
  };
}

export function headerBlock(d: WebhookDelivery): string {
  return [
    `POST /api/youpi-webhook HTTP/1.1`,
    `Host: merchant.example.com`,
    `Content-Type: application/json`,
    `X-Gateway-Event: ${d.event}`,
    `X-Gateway-Signature: ${d.signature}`,
    `X-Gateway-Delivery-Id: ${d.deliveryId}`,
    `X-Gateway-Timestamp: ${d.timestamp}`,
    ``,
    d.payload,
  ].join("\n");
}
