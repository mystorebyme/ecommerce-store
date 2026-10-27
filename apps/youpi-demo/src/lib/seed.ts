import { randomId, randomUtr } from "./format";
import { defaultBranding, defaultObservers, defaultSettings } from "./config";
import { makeDelivery } from "./webhook";
import type { DemoState, Session, WebhookDelivery } from "./types";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function pastSession(
  offsetMs: number,
  orderId: string,
  amountPaise: number,
  status: Session["status"],
  extra: Partial<Session> = {},
): Session {
  const createdAt = Date.now() - offsetMs;
  return {
    id: randomId("pay", 12),
    orderId,
    amountPaise,
    method: "UPI",
    status,
    createdAt,
    payDeadline: createdAt + 5 * MIN,
    verifyDeadline: createdAt + 5 * MIN + 30_000,
    customer: {
      name: extra.customer?.name ?? "Ananya Verma",
      phone: extra.customer?.phone ?? "9876543210",
      verifiedAt: createdAt - 40_000,
    },
    utr: extra.utr,
    note: extra.note,
    source: extra.source ?? "store",
    attempts: 1,
    reason: extra.reason,
  };
}

export function initialState(): DemoState {
  const settings = { ...defaultSettings };

  const sessions: Session[] = [
    pastSession(2 * HOUR, "YP-1041", 100, "SUCCESS", {
      utr: randomUtr(),
      note: "Demo pack · ₹1",
    }),
    pastSession(4 * HOUR + 12 * MIN, "YP-1040", 4900, "SUCCESS", { utr: randomUtr() }),
    pastSession(6 * HOUR + 40 * MIN, "YP-1039", 14900, "REFUNDED", {
      utr: randomUtr(),
      note: "Customer cancelled before dispatch",
    }),
    pastSession(DAY + 2 * HOUR, "YP-1038", 1000, "EXPIRED", {
      reason: "Payment window elapsed — slot released to queue",
    }),
    pastSession(DAY + 5 * HOUR, "YP-1037", 100, "FAILED", {
      reason: "No matching bank observation inside the 30s verify window",
    }),
    pastSession(2 * DAY + 3 * HOUR, "YP-1036", 189900, "SUCCESS", {
      utr: randomUtr(),
      note: "Aarohi Handloom Kurta · M",
    }),
    pastSession(2 * DAY + 9 * HOUR, "YP-1035", 1000, "CANCELLED", {
      reason: "Buyer closed the checkout modal",
    }),
    pastSession(3 * DAY + 4 * HOUR, "YP-1034", 100, "SUSPICIOUS", {
      reason: "Two payment attempts from a blocked device fingerprint",
    }),
  ];

  const deliveries: WebhookDelivery[] = [];
  for (const s of sessions) {
    if (s.status === "SUCCESS") {
      deliveries.push(
        makeDelivery("SUCCESS", s, settings, {
          timestamp: s.createdAt + 6 * MIN,
          utr: s.utr,
        }),
      );
    }
    if (s.status === "REFUNDED") {
      deliveries.push(
        makeDelivery("REFUNDED", s, settings, {
          timestamp: s.createdAt + 30 * MIN,
          utr: s.utr,
          status: "delivered",
        }),
      );
    }
  }
  deliveries.sort((a, b) => b.timestamp - a.timestamp);

  const now = Date.now();

  return {
    sessions: sessions.sort((a, b) => b.createdAt - a.createdAt),
    events: [
      {
        id: randomId("obs", 8),
        channel: "android",
        receivedAt: now - 2 * MIN,
        amountPaise: 100,
        utr: sessions[0].utr ?? randomUtr(),
        bank: "HDFC Bank",
        raw: "HDFC Bank: Rs.1.00 credited to A/c XX4471 on 27-10-26. UPI ref 4XXXXXXXXXXX. -YP",
        matchedSessionId: sessions[0].id,
        verdict: "matched",
      },
      {
        id: randomId("obs", 8),
        channel: "gmail",
        receivedAt: now - 4 * HOUR,
        amountPaise: 4900,
        utr: sessions[1].utr ?? randomUtr(),
        bank: "ICICI Bank",
        raw: "Your a/c XX4471 is credited with INR 49.00 on 27-Oct-26 by UPI. Ref no 4XXXXXXXXXXX.",
        matchedSessionId: sessions[1].id,
        verdict: "matched",
      },
      {
        id: randomId("obs", 8),
        channel: "sms",
        receivedAt: now - 5 * HOUR,
        amountPaise: 100,
        utr: randomUtr(),
        bank: "HDFC Bank",
        raw: "Rs.1.00 credited to A/c XX4471. UPI ref 4XXXXXXXXXXX.",
        verdict: "unmatched",
      },
    ],
    deliveries,
    audit: [
      {
        id: randomId("aud", 8),
        at: now - 26 * MIN,
        actor: "owner@merchant",
        action: "branding.update",
        entity: "settings",
        detail: "Primary colour #0B5E4F · logo mark YP",
      },
      {
        id: randomId("aud", 8),
        at: now - 3 * HOUR,
        actor: "owner@merchant",
        action: "webhook.secret.rotate",
        entity: "webhook",
        detail: "New signing secret active, old secret valid for 24h",
      },
      {
        id: randomId("aud", 8),
        at: now - DAY,
        actor: "support@merchant",
        action: "payment.confirm.manual",
        entity: "YP-1036",
        detail: "Manual confirm after UTR matched bank statement",
      },
    ],
    observers: defaultObservers.map((o) => ({ ...o, lastHeartbeat: now - 4_000 })),
    branding: { ...defaultBranding },
    settings,
    bans: [
      {
        id: randomId("ban", 8),
        fingerprint: "fp_9c21ab77f0",
        reason: "Repeated abandoned sessions from one device (6 in 10 min)",
        at: now - 3 * DAY,
        hits: 6,
      },
    ],
    otp: null,
    customer: null,
    activeVpa: settings.vpa,
    lastCreatedId: null,
    seededAt: now,
  };
}
