// Purpose: Idempotency-Key: double-click par double order nahi
//
// Rule #6: order create idempotent. Client ek hi key dobara bheje to wahi order
// milta hai, naya nahi banta. Key ko plain store nahi karte — SHA-256 hash DB me
// jaata hai (logs/DB leak ho jaye to bhi client ka token guess na ho).

import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "./error.middleware";

export const IDEMPOTENCY_HEADER = "idempotency-key";

export function hashIdempotencyKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function idempotency(options: { required?: boolean } = {}) {
  const required = options.required !== false;
  return (req: Request, _res: Response, next: NextFunction): void => {
    const raw = req.header(IDEMPOTENCY_HEADER)?.trim();
    if (!raw) {
      if (required) {
        next(
          AppError.badRequest(
            "IDEMPOTENCY_KEY_REQUIRED",
            `${IDEMPOTENCY_HEADER} header chahiye (8-128 chars, retry par same key).`,
          ),
        );
        return;
      }
      next();
      return;
    }
    if (raw.length < 8 || raw.length > 128) {
      next(AppError.badRequest("IDEMPOTENCY_KEY_INVALID", "Idempotency-Key 8 se 128 characters ke beech hona chahiye."));
      return;
    }
    req.idempotencyKey = hashIdempotencyKey(raw);
    next();
  };
}
