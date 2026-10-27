// Purpose: Zod validation runner
//
// Schemas `packages/validation` se aate hain (single source of truth).
// Validation fail = 422, message field-wise, taaki frontend form me seedha dikha sake.

import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { AppError } from "./error.middleware";

type Source = "body" | "query" | "params";

export function validate(schema: ZodTypeAny, source: Source = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(
        AppError.unprocessable(
          "VALIDATION_FAILED",
          "Request data valid nahi hai.",
          result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        ),
      );
      return;
    }
    // Parsed (transformed) value hi aage jaati hai — raw input kabhi use nahi hota.
    if (source === "body") req.body = result.data;
    else if (source === "query") Object.assign(req.query, result.data);
    else Object.assign(req.params, result.data);
    next();
  };
}
