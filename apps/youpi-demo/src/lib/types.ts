export type SessionStatus =
  | "ACTIVE"
  | "QUEUED"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED"
  | "SUSPICIOUS"
  | "REFUNDED";

export type PayMethod = "UPI" | "CASH_COUNTER" | "CARD_COUNTER";

export interface Customer {
  name: string;
  phone: string;
  verifiedAt: number;
}

export interface Session {
  id: string;
  orderId: string;
  amountPaise: number;
  method: PayMethod;
  status: SessionStatus;
  createdAt: number;
  payDeadline: number;
  verifyDeadline?: number;
  verifyStartedAt?: number;
  customer?: Customer;
  simOutcome?: "success" | "mismatch" | "timeout" | "suspicious";
  utr?: string;
  queuePos?: number;
  note?: string;
  source: "store" | "demo-pack" | "admin-test";
  reason?: string;
  attempts: number;
}

export type ObserverChannel = "android" | "gmail" | "sms";

export interface ObserverState {
  channel: ObserverChannel;
  label: string;
  status: "online" | "degraded" | "offline";
  lastHeartbeat: number;
  detail: string;
  metric: string;
}

export interface ObserverEvent {
  id: string;
  channel: ObserverChannel;
  receivedAt: number;
  amountPaise: number;
  utr: string;
  bank: string;
  raw: string;
  matchedSessionId?: string;
  verdict: "matched" | "unmatched" | "amount-mismatch";
}

export interface WebhookDelivery {
  id: string;
  deliveryId: string;
  event: "SUCCESS" | "REFUNDED" | "FAILED";
  orderId: string;
  sessionId: string;
  amountPaise: number;
  utr: string;
  signature: string;
  timestamp: number;
  status: "delivered" | "retrying" | "failed";
  attempts: number;
  payload: string;
}

export interface AuditEntry {
  id: string;
  at: number;
  actor: string;
  action: string;
  entity: string;
  detail: string;
}

export interface Branding {
  appName: string;
  tagline: string;
  primaryColor: string;
  supportEmail: string;
  supportPhone: string;
  footerGuarantee: string;
  hidePoweredBy: boolean;
  logoMark: string;
}

export interface Settings {
  vpa: string;
  merchantName: string;
  publicKey: string;
  webhookUrl: string;
  webhookSecret: string;
  testMode: boolean;
  payWindowSeconds: number;
  verifyWindowSeconds: number;
  allowCod: boolean;
  allowCounter: boolean;
}

export interface BanEntry {
  id: string;
  fingerprint: string;
  reason: string;
  at: number;
  hits: number;
}

export interface OtpState {
  phone: string;
  code: string;
  sentAt: number;
  verified: boolean;
}

export interface DemoState {
  sessions: Session[];
  events: ObserverEvent[];
  deliveries: WebhookDelivery[];
  audit: AuditEntry[];
  observers: ObserverState[];
  branding: Branding;
  settings: Settings;
  bans: BanEntry[];
  otp: OtpState | null;
  customer: Customer | null;
  activeVpa: string;
  lastCreatedId: string | null;
  seededAt: number;
}
