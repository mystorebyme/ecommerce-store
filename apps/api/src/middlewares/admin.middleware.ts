// Purpose: Admin token guard (shared by settings + links + ops routes)
//
// Token `x-admin-token` header me aata hai (ADMIN_API_TOKEN). Kabhi URL/query me nahi —
// warna logs/browser history me leak ho jaata hai.

import type { NextFunction, Request, Response } from "express";
import { AppError } from "./error.middleware";

export function requireAdminToken(adminToken: string) {
  return function adminGuard(req: Request, _res: Response, next: NextFunction): void {
    if (!adminToken) {
      next(AppError.unavailable("ADMIN_TOKEN_MISSING", "ADMIN_API_TOKEN set nahi hai — admin routes band hain."));
      return;
    }
    if (req.header("x-admin-token") !== adminToken) {
      next(AppError.unauthorized("ADMIN_UNAUTHORIZED", "x-admin-token galat hai."));
      return;
    }
    next();
  };
}

/** Audit log ke liye context — actor/ip/requestId. */
export function auditContext(req: Request): { actor: string; ip: string | null; requestId: string | null } {
  return {
    actor: "admin:token",
    ip: req.ip ?? null,
    requestId: req.requestId ?? null,
  };
}
