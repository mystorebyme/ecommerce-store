// Purpose: Bank observer ka inbound webhook — signed observation ingest.
//
// Observer (Android app / Gmail watcher / Messages web) bank ka SMS padh kar yahan
// POST karta hai. Raw body + HMAC `x-observer-signature` verify hoti hai
// (`OBSERVER_SHARED_SECRET`), phir `observers.service` match/settle karta hai.
//
// Rule: ye endpoint bina proof ke kuch accept nahi karta — warna koi bhi
// "₹1,899 credited" bhej kar free order le sakta hai.
//
// Do auth modes:
//   1. `x-observer-signature: sha256=<hmac>` — default (hamara Android app / Apps Script)
//   2. `x-observer-token: <OBSERVER_SHARED_SECRET>` — generic SMS-forwarder apps ke liye
//      (jo HMAC nahi kar sakte). Kamzor hai: sirf HTTPS + rotate karte raho.

import type { Request, Response } from "express";
import { AppError } from "../middlewares/error.middleware";
import type { ObserversService } from "../modules/gateway/observers.service";
import type { ObservationInput } from "@youpi/validation";

export interface ObserverWebhookDeps {
  observers: ObserversService;
  /** Shared secret — observers aur server dono ke paas. */
  secret: string;
  verifySignature: (input: { rawBody: Buffer | string; signature: string | null; secret: string }) => boolean;
  /** Token mode (generic forwarder apps) — constant-time compare. */
  verifyToken?: (provided: string | null, secret: string) => boolean;
}

export function createObserverWebhook({ observers, secret, verifySignature, verifyToken }: ObserverWebhookDeps) {
  return async function handleObservation(req: Request, res: Response): Promise<void> {
    if (!secret) {
      throw AppError.unavailable(
        "OBSERVER_SECRET_MISSING",
        "OBSERVER_SHARED_SECRET set nahi hai — observers accept nahi ho sakte.",
      );
    }
    const signature = req.header("x-observer-signature") ?? null;
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const queryToken = typeof req.query.token === "string" ? req.query.token : null;
    const token = req.header("x-observer-token") ?? queryToken;

    const signatureOk = verifySignature({ rawBody, signature, secret });
    const tokenOk = !signatureOk && verifyToken ? verifyToken(token, secret) : false;

    if (!signatureOk && !tokenOk) {
      throw AppError.unauthorized(
        "OBSERVER_SIGNATURE_INVALID",
        "Observer proof verify nahi hua. Device ne galat secret/token use kiya?",
      );
    }

    const body = JSON.parse(rawBody.toString("utf8")) as ObservationInput;
    const result = await observers.ingest({
      source: body.source,
      deviceId: body.deviceId,
      messageId: body.messageId,
      rawText: body.rawText,
      amountPaise: body.amountPaise,
      utr: body.utr,
      senderVpa: body.senderVpa,
      bankName: body.bankName,
      observedAt: body.observedAt,
    });

    // 200 hamesha — observer ko retry loop me na daalo. Verdict body me aata hai.
    res.status(200).json({
      data: {
        verdict: result.verdict,
        message: result.message,
        observationId: result.observation.id,
        sessionId: result.session?.id ?? null,
        status: result.session?.status ?? null,
      },
    });
  };
}
