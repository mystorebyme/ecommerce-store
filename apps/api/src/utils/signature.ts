// Purpose: HMAC signature helpers — observers, outbound webhooks, merchants
//
// Ek hi jagah: sabhi signatures `sha256=<hex>` format me, timing-safe compare.

import { createHmac, timingSafeEqual } from "node:crypto";

export function hmacSha256Hex(payload: Buffer | string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Full header value: `sha256=<hex>` */
export function hmacSha256Header(payload: Buffer | string, secret: string): string {
  return `sha256=${hmacSha256Hex(payload, secret)}`;
}

/** Header me `sha256=` prefix ho ya na ho — dono chalte hain. */
export function verifyHmacSha256(input: {
  rawBody: Buffer | string;
  signature: string | null;
  secret: string;
}): boolean {
  if (!input.signature || !input.secret) return false;
  const received = input.signature.replace(/^sha256=/i, "").trim().toLowerCase();
  const expected = hmacSha256Hex(input.rawBody, input.secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
