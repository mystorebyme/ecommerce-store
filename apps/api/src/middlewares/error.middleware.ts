// Purpose: Central error handler
//
// Har error ek shape me client tak jaata hai: { error: { code, message, requestId } }.
// 5xx par stack kabhi response me nahi jaata.

import type { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(code: string, message: string, details?: unknown) {
    return new AppError(400, code, message, details);
  }
  static notFound(code: string, message: string) {
    return new AppError(404, code, message);
  }
  static conflict(code: string, message: string, details?: unknown) {
    return new AppError(409, code, message, details);
  }
  static unprocessable(code: string, message: string, details?: unknown) {
    return new AppError(422, code, message, details);
  }
  static unauthorized(code: string, message: string) {
    return new AppError(401, code, message);
  }
  static unavailable(code: string, message: string, details?: unknown) {
    return new AppError(503, code, message, details);
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.path} exists nahi karta.`, requestId: req.requestId },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId: req.requestId,
      },
    });
    return;
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  req.log?.error?.({ err: message }, "unhandled_error");

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      // Production me generic message — internals leak nahi karte.
      message: process.env.NODE_ENV === "production" ? "Something went wrong. Try again." : message,
      requestId: req.requestId,
    },
  });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      idempotencyKey?: string;
      rawBody?: Buffer;
      log?: { info: (obj: unknown, msg?: string) => void; error: (obj: unknown, msg?: string) => void };
    }
  }
}

/**
 * Express 4 async handlers ke errors automatically next() nahi jaate.
 * Isliye har async route is wrapper se guzarta hai:
 *   router.post("/", asyncHandler(handler))
 */
export function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}
