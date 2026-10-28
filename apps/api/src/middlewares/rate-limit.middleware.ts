// Purpose: Simple in-memory rate limit (payment/pay routes ke liye)
//
// Serverless par per-instance hota hai — isliye ye "best effort" guard hai, DoS ka
// poora solution nahi. Iska kaam: ek hi IP se QR spam / order spam rokna.
// Production me iske upar Vercel platform limits + DB constraints hain.

import type { NextFunction, Request, Response } from "express";
import { AppError } from "./error.middleware";

interface Bucket {
  count: number;
  resetAt: number;
}

export function rateLimit(options: { windowMs: number; max: number; keyPrefix?: string }) {
  const buckets = new Map<string, Bucket>();
  const { windowMs, max, keyPrefix = "" } = options;

  return function limiter(req: Request, res: Response, next: NextFunction): void {
    const ip = req.ip ?? "unknown";
    const key = `${keyPrefix}:${ip}`;
    const nowMs = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= nowMs) {
      buckets.set(key, { count: 1, resetAt: nowMs + windowMs });
      res.setHeader("x-ratelimit-limit", String(max));
      res.setHeader("x-ratelimit-remaining", String(max - 1));
      next();
      return;
    }

    bucket.count += 1;
    res.setHeader("x-ratelimit-limit", String(max));
    res.setHeader("x-ratelimit-remaining", String(Math.max(0, max - bucket.count)));

    // Memory clean-up: bohat zyada keys jama na hon.
    if (buckets.size > 5000) {
      for (const [entryKey, entry] of buckets) {
        if (entry.resetAt <= nowMs) buckets.delete(entryKey);
      }
    }

    if (bucket.count > max) {
      res.setHeader("retry-after", String(Math.ceil((bucket.resetAt - nowMs) / 1000)));
      next(AppError.tooManyRequests("RATE_LIMITED", "Bohat zyada requests — thodi der baad try karo."));
      return;
    }
    next();
  };
}
