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

/**
 * Observer ka doosra auth mode: shared token (constant-time compare).
 *
 * Kyun: Play Store ke generic SMS-forwarder apps (SMS to URL Forwarder, MacroDroid) HMAC
 * compute nahi kar sakte — sirf URL + headers bhej sakte hain. Un ke liye `x-observer-token`
 * (ya `?token=`) support karte hain. Ye HMAC se kamzor hai (token replay ho sakta hai),
 * isliye HMAC default hai aur token sirf tab use karo jab app HMAC na kar sake.
 */
export function verifySharedToken(provided: string | null, secret: string): boolean {
  if (!provided || !secret) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
