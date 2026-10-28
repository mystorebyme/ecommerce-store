// Purpose: Bank observer se aayi credit entry ko session se match karna.
//
// Ye gateway ka "bank statement padhne wala" hissa hai. Android app bank ka SMS
// padhta hai (ya Gmail/Messages se forward hota hai) aur **raw text** yahan bhejta hai.
//
// Matching rules (order matters — pehla jo match kare wahi final):
//   1. UTR dobara aa gaya  → DUPLICATE (idempotent, kuch nahi hota)
//   2. Debit / parse fail  → 422 (credit hi accept karte hain)
//   3. Amount exact match  → us amount ke live sessions dekho
//        - ek hi live session  → wahi (attribution exact amount se)
//        - kai live sessions   → raw text me `reference` (tn) dhoondho; na mile to SUSPICIOUS
//   4. Cross-source confirm → 2 independent sources (ya 1 trusted Android SMS) = SUCCESS
//        warna PROCESSING (30 s verify window), timeout par SUSPICIOUS
//   5. Koi match nahi       → UNMATCHED (paisa aaya par order nahi mila → refund/manual)

import type { Db, MerchantRow, ObservationRow, ObservationSource, SessionRow } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import type { GatewayService } from "./gateway.service";
import { isDebitMessage, parseBankMessage } from "./sms-parser";

export interface ObserverDeps {
  db: Db;
  gateway: GatewayService;
  now?: () => Date;
  /** Trusted sources: inse aayi entry akeli bhi confirm kar sakti hai. */
  trustedSources?: ObservationSource[];
}

export interface IngestInput {
  source: ObservationSource;
  deviceId: string;
  messageId: string;
  rawText?: string;
  amountPaise?: number;
  utr?: string;
  senderVpa?: string;
  bankName?: string;
  observedAt?: Date;
}

export type Verdict = "SUCCESS" | "PROCESSING" | "DUPLICATE" | "UNMATCHED" | "SUSPICIOUS";

export interface IngestResult {
  verdict: Verdict;
  observation: ObservationRow;
  session: SessionRow | null;
  message: string;
}

export function createObserversService({ db, gateway, now = () => new Date(), trustedSources = ["ANDROID_SMS"] }: ObserverDeps) {
  async function merchantOrFail(): Promise<MerchantRow> {
    const merchant = await db.getMerchant();
    if (!merchant) throw AppError.unavailable("MERCHANT_NOT_CONFIGURED", "Merchant VPA configure nahi hai.");
    return merchant;
  }

  return {
    async ingest(input: IngestInput): Promise<IngestResult> {
      const merchant = await merchantOrFail();

      // 0. Debit message bilkul pehle reject — warna parse fail ka message confusing hoga.
      if (input.rawText && isDebitMessage(input.rawText)) {
        throw AppError.unprocessable("NOT_A_CREDIT", "Ye debit message hai — sirf credit entries accept hoti hain.");
      }

      // 1. Raw text → normalise (parsing server par, taaki rules ek jagah rahein)
      const parsed = input.rawText ? parseBankMessage(input.rawText) : null;

      const amountPaise = input.amountPaise ?? parsed?.amountPaise ?? null;
      const utr = input.utr ?? parsed?.utr ?? null;

      if (!amountPaise || !utr) {
        throw AppError.unprocessable(
          "UNPARSEABLE_MESSAGE",
          "SMS se amount/UTR nahi nikla. Observer structured fields (amountPaise + utr) bhej sakta hai.",
          { rawText: input.rawText?.slice(0, 200) },
        );
      }

      const observedAt = input.observedAt ?? now();

      // 2. Dedupe: ek UTR ek hi baar store hota hai (reconciliation ke liye).
      const sameMessage = await db.findObservationByMessage(input.deviceId, input.messageId);
      const byUtr = await db.findObservationsByUtr(utr);
      const existing = sameMessage ?? byUtr.find((row) => row.source === input.source) ?? byUtr[0];

      if (existing) {
        const linked = existing.sessionId ? await db.findSessionById(existing.sessionId) : null;

        // 2b. Cross-source confirmation: dusre source se wahi UTR aaya aur session
        // abhi PROCESSING hai → yahi "second proof" hai, isliye settle karte hain.
        const crossSource =
          linked !== null &&
          linked.status === "PROCESSING" &&
          existing.source !== input.source &&
          sameMessage === null;

        if (crossSource) {
          const settled = await gateway.settle({
            sessionId: linked!.id,
            utr,
            senderVpa: linked!.senderVpa ?? existing.senderVpa,
          });
          await db.updateObservation(existing.id, { status: "MATCHED" });
          return {
            verdict: "SUCCESS",
            observation: existing,
            session: settled,
            message: `Second source (${input.source}) ne ${existing.source} ki entry confirm ki — order PAID.`,
          };
        }

        return {
          verdict: "DUPLICATE",
          observation: existing,
          session: linked,
          message: "Ye credit pehle hi record ho chuka hai — kuch nahi badla.",
        };
      }

      // 3. Observation save
      const inserted = await db.insertObservation({
        source: input.source,
        deviceId: input.deviceId,
        messageId: input.messageId,
        rawText: input.rawText?.slice(0, 500) ?? `manual:${amountPaise}:${utr}`,
        amountPaise,
        utr,
        senderVpa: (input.senderVpa ?? parsed?.senderVpa ?? null)?.toLowerCase() ?? null,
        bankName: input.bankName ?? parsed?.bankName ?? null,
        direction: "CREDIT",
        observedAt,
      });
      if (!inserted.inserted || !inserted.row) {
        return {
          verdict: "DUPLICATE",
          observation: inserted.row!,
          session: null,
          message: "Duplicate credit — ignore.",
        };
      }
      const observation = inserted.row;

      // 4. Attribution: exact amount wale live sessions
      const candidates = await db.findLiveSessionsByAmount(merchant.id, amountPaise);

      if (candidates.length === 0) {
        await db.updateObservation(observation.id, { status: "UNMATCHED" });
        return {
          verdict: "UNMATCHED",
          observation,
          session: null,
          message: `₹${(amountPaise / 100).toFixed(2)} ka credit aaya par koi live session nahi mila — manual review/refund.`,
        };
      }

      let session: SessionRow;
      if (candidates.length === 1) {
        session = candidates[0]!;
      } else {
        // Ambiguous amount: QR note (reference) se pehchano
        const byReference = candidates.find((candidate) => (input.rawText ?? "").toUpperCase().includes(candidate.reference));
        if (!byReference) {
          await db.updateObservation(observation.id, { status: "SUSPICIOUS" });
          return {
            verdict: "SUSPICIOUS",
            observation,
            session: null,
            message: `${candidates.length} sessions ka same amount hai aur note se pehchan nahi hui — manual review chahiye.`,
          };
        }
        session = byReference;
      }
      const matched: SessionRow = session;

      await db.updateObservation(observation.id, { status: "MATCHED", sessionId: matched.id });

      // 5. Cross-source confirmation
      const sameUtr = await db.findObservationsByUtr(utr);
      const distinctSources = new Set(sameUtr.map((row) => row.source));
      const confirmed = trustedSources.includes(input.source) || distinctSources.size >= 2;

      if (!confirmed) {
        const processing = await gateway.markProcessing(matched.id, merchant);
        return {
          verdict: "PROCESSING",
          observation,
          session: processing,
          message:
            "Credit match ho gaya. Second source (ya Android observer) se confirm hone par PAID hoga — 30 s window.",
        };
      }

      const settled = await gateway.settle({
        sessionId: matched.id,
        utr,
        senderVpa: observation.senderVpa,
      });
      return {
        verdict: "SUCCESS",
        observation,
        session: settled,
        message: `Payment confirmed — order ${settled.orderId} PAID, UTR ${utr}.`,
      };
    },
  };
}

export type ObserversService = ReturnType<typeof createObserversService>;
