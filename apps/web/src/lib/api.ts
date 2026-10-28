// Purpose: API client (server-side) — catalog, orders, payments
//
// Sab calls server se jaate hain (ya `/api/gateway` proxy ke through browser se).
// API ka URL browser me kabhi nahi jaata; price hamesha server decide karta hai.

export const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export interface Product {
  id: string;
  sku: string;
  name: string;
  pricePaise: number;
  inStock: boolean;
  stock: number;
}

export interface Order {
  id: string;
  number: string;
  status: "PENDING_PAYMENT" | "PAID" | "EXPIRED" | "CANCELLED";
  amountPaise: number;
  currency: string;
  customer: { name: string; phone: string };
  items: { sku: string; name: string; unitPricePaise: number; qty: number; lineTotalPaise: number }[];
  createdAt: string;
}

export type SessionStatus =
  | "QUEUED"
  | "ACTIVE"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED"
  | "SUSPICIOUS";

export interface PaymentSession {
  sessionId: string;
  orderId: string;
  orderNumber: string;
  status: SessionStatus;
  amountPaise: number;
  currency: string;
  reference: string;
  vpa: string;
  utr: string | null;
  queuePosition: number;
  aheadInQueue: number;
  payExpiresAt: string;
  verifyExpiresAt: string | null;
  secondsLeftToPay: number;
  secondsLeftToVerify: number | null;
  upi: { string: string; svg: string | null; dataUrl: string | null };
  live: boolean;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Server-side API call.
 *
 * `revalidateSeconds > 0` = ISR-friendly fetch (Next ise Data Cache me rakhta hai,
 * page bhi CDN par static ho jaata hai → India se ~20-40ms TTFB).
 * `0` = hamesha fresh (order/payment status — yahan stale data galat hoga).
 */
async function request<T>(path: string, init: RequestInit = {}, revalidateSeconds = 0): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    ...(revalidateSeconds > 0 ? { next: { revalidate: revalidateSeconds } } : { cache: "no-store" as RequestCache }),
  });

  const text = await response.text();
  const body = text ? (JSON.parse(text) as { data?: T; error?: { code: string; message: string } }) : {};

  if (!response.ok || body.error) {
    throw new ApiError(
      response.status,
      body.error?.code ?? "REQUEST_FAILED",
      body.error?.message ?? `API ${response.status}`,
    );
  }
  return body.data as T;
}

// ---------------------------------------------------------------- catalog
export async function listProducts(revalidateSeconds = 30): Promise<Product[]> {
  try {
    const response = await fetch(`${API_URL}/api/v1/products?limit=24`, {
      next: { revalidate: revalidateSeconds },
      headers: { accept: "application/json" },
    });
    if (!response.ok) return [];
    const json = (await response.json()) as { data: Product[] };
    return json.data;
  } catch {
    // API band ho to store crash na ho — khaali catalog dikhao.
    return [];
  }
}

export async function getProduct(id: string, revalidateSeconds = 30): Promise<Product | null> {
  try {
    return await request<Product>(`/products/${encodeURIComponent(id)}`, {}, revalidateSeconds);
  } catch {
    return null;
  }
}

export async function getOrder(id: string): Promise<Order | null> {
  try {
    return await request<Order>(`/orders/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

export async function getSession(id: string): Promise<PaymentSession | null> {
  try {
    return await request<PaymentSession>(`/payments/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- money
export function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------- payment links
export interface PublicLink {
  token: string;
  kind: "FIXED" | "OPEN";
  title: string;
  note: string;
  status: "ACTIVE" | "EXPIRED" | "DISABLED" | "USED_UP";
  amountPaise: number | null;
  minAmountPaise: number | null;
  maxAmountPaise: number | null;
  expiresAt: string | null;
  remainingUses: number;
  payee: { name: string; vpa: string };
}

/** Server-side: link ki sach (amount server se — URL se kabhi nahi). */
export async function getLink(token: string): Promise<PublicLink | null> {
  try {
    return await request<PublicLink>(`/pay/links/${encodeURIComponent(token)}`);
  } catch {
    return null;
  }
}

export async function getPayLimits(): Promise<{ minAmountPaise: number; maxAmountPaise: number }> {
  try {
    return await request<{ minAmountPaise: number; maxAmountPaise: number }>("/pay/limits", {}, 30);
  } catch {
    return { minAmountPaise: 100, maxAmountPaise: 5_000_000 };
  }
}
