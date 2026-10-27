// Purpose: Har request ka ID (logs trace karne ke liye)

import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  req.requestId = incoming && incoming.length <= 64 ? incoming : randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
}
