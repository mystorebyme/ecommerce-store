// Purpose: Gateway ka core engine — session banao, single-slot FIFO queue chalao,
// dual server timers sambhalo, aur settle hone par merchant ko webhook bhejo.
//
// Yahan "gateway" ka matlab: hamara apna self-hosted UPI gateway (koi Razorpay/PayU
// nahi). Paisa buyer → merchant ke apne VPA. Hamara kaam sirf attribution + proof.

import { randomBytes } from "node:crypto";
import type { Db, MerchantRow, OrderWithItems, SessionRow } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { buildQrSvg, buildUpiString, svgToDataUrl } from "./gateway.qr";

export interface GatewayDeps {
  db: Db;
  now?: () => Date;
  /** Session SUCCESS hone par (webhook + notifications) — app wiring isse deta hai. */
  onSettled?: (input: SettledInput) => Promise<void> | void;
  /** Session expire/suspect hone par (metrics/logs). */
  onClosed?: (input: { session: SessionRow; reason: string }) => Promise<void> | void;
}

export interface SettledInput {
  session: SessionRow;
  order: OrderWithItems;
  merchant: MerchantRow;
  utr: string;
}

export interface SessionView {
  sessionId: string;
  orderId: string;
  orderNumber: string;
  status: SessionRow["status"];
  amountPaise: number;
  currency: string;
  reference: string;
  vpa: string;
  utr: string | null;
  /** 1 = is waqt QR live hai, 2+ = kitne buyers aage hain (FIFO) */
  queuePosition: number;
  aheadInQueue: number;
  payExpiresAt: string;
  verifyExpiresAt: string | null;
  secondsLeftToPay: number;
  secondsLeftToVerify: number | null;
  upi: { string: string; svg: string | null; dataUrl: string | null };
  live: boolean;
}

export function createGatewayService({ db, now = () => new Date(), onSettled, onClosed }: GatewayDeps) {
  function secondsBetween(target: Date, from = now()): number {
    return Math.max(0, Math.round((target.getTime() - from.getTime()) / 1000));
  }

  async function requireMerchant(): Promise<MerchantRow> {
    const merchant = await db.getMerchant();
    if (!merchant) {
      throw AppError.unavailable(
        "MERCHANT_NOT_CONFIGURED",
        "Merchant VPA set nahi hai. `POST /api/v1/admin/merchant` se VPA + payee name configure karo.",
      );
    }
    return merchant;
  }

  /**
   * Order ka short reference — QR ke `tn` note me jaata hai (bank statement me yahi dikhta hai).
   * 6-20 chars, uppercase alnum. Random suffix isliye ki ek hi millisecond ke do sessions
   * kabhi collide na karein (same amount wale buyers ka attribution isi par tika hai).
   */
  function referenceFor(at: Date): string {
    const base = at.getTime().toString(36).toUpperCase().slice(-5);
    const tail = randomBytes(3).toString("hex").toUpperCase().slice(0, 5);
    return `YP${base}${tail}`;
  }

  const LIVE: SessionRow["status"][] = ["QUEUED", "ACTIVE", "PROCESSING"];

  async function buildView(session: SessionRow): Promise<SessionView> {
    const order = await db.findOrderById(session.orderId);
    const [queued, active] = await Promise.all([
      db.listSessionsByStatus(session.merchantId, "QUEUED"),
      db.listSessionsByStatus(session.merchantId, "ACTIVE"),
    ]);
    const index = queued.findIndex((queuedSession) => queuedSession.id === session.id);

    // position 1 = QR live. Queued buyer ke aage: jo ACTIVE hai + queue me apne se pehle wale.
    let position = 1;
    if (session.status === "QUEUED") {
      position = active.length + (index >= 0 ? index : queued.length) + 1;
    } else if (session.status === "ACTIVE" || session.status === "PROCESSING") {
      position = 1;
    } else {
      position = 0;
    }

    const svg = session.status === "ACTIVE" ? await buildQrSvg(session.upiString) : null;

    return {
      sessionId: session.id,
      orderId: session.orderId,
      orderNumber: order?.number ?? "",
      status: session.status,
      amountPaise: session.amountPaise,
      currency: session.currency,
      reference: session.reference,
      vpa: session.vpa,
      utr: session.utr,
      queuePosition: position,
      aheadInQueue: session.status === "QUEUED" ? Math.max(0, position - 1) : 0,
      payExpiresAt: session.payExpiresAt.toISOString(),
      verifyExpiresAt: session.verifyExpiresAt ? session.verifyExpiresAt.toISOString() : null,
      secondsLeftToPay: session.status === "ACTIVE" ? secondsBetween(session.payExpiresAt) : 0,
      secondsLeftToVerify: session.verifyExpiresAt ? secondsBetween(session.verifyExpiresAt) : null,
      upi: { string: session.upiString, svg, dataUrl: svg ? svgToDataUrl(svg) : null },
      live: LIVE.includes(session.status),
    };
  }

  const service = {
    /**
     * `vpaOverride` sirf ek case me: admin ne naya VPA stage kiya hai aur us par
     * **₹1 test** chal raha hai. Normal orders me kabhi override nahi hota — warna
     * live QR kisi unverified VPA par chala jaata.
     */
    async startForOrder(input: { orderId: string; vpaOverride?: string | null }): Promise<SessionView> {
      const merchant = await requireMerchant();
      const order = await db.findOrderById(input.orderId);
      if (!order) throw AppError.notFound("ORDER_NOT_FOUND", "Order nahi mila.");

      // Idempotent: is order ka koi live session pehle se hai to wahi wapas do.
      const existing = (await db.listSessionsForOrder(order.id)).find((session) => LIVE.includes(session.status));
      if (existing) return buildView(existing);

      if (order.status !== "PENDING_PAYMENT") {
        throw AppError.conflict("ORDER_NOT_PAYABLE", `Order ${order.number} ka status ${order.status} hai.`);
      }

      // Ek VPA par ek hi ACTIVE slot — baaki FIFO queue me (single-slot design).
      const active = await db.listSessionsByStatus(merchant.id, "ACTIVE");
      const queued = await db.listSessionsByStatus(merchant.id, "QUEUED");
      const isActiveSlotFree = active.length < Math.max(1, merchant.slotConcurrency);

      const reference = referenceFor(now());
      const payVpa = input.vpaOverride ?? merchant.vpa;
      const upiString = buildUpiString({
        vpa: payVpa,
        payeeName: merchant.payeeName,
        amountPaise: order.amountPaise,
        reference,
        transactionRef: order.id,
        merchantCode: merchant.merchantCode ?? null,
      });

      const session = await db.createSession({
        orderId: order.id,
        merchantId: merchant.id,
        amountPaise: order.amountPaise,
        currency: order.currency,
        reference,
        upiString,
        vpa: payVpa,
        queuePosition: queued.length + 1,
        payExpiresAt: new Date(now().getTime() + merchant.payWindowSeconds * 1000),
        status: isActiveSlotFree ? "ACTIVE" : "QUEUED",
      });

      return buildView(session);
    },

    async getView(sessionId: string): Promise<SessionView> {
      const session = await db.findSessionById(sessionId);
      if (!session) throw AppError.notFound("SESSION_NOT_FOUND", "Payment session nahi mila.");
      await service.runTimers(); // refresh par bhi timers sach bolte hain (browser band ho to bhi)
      const fresh = (await db.findSessionById(sessionId)) ?? session;
      return buildView(fresh);
    },

    async cancel(sessionId: string, reason = "CANCELLED_BY_BUYER"): Promise<SessionView> {
      const session = await db.findSessionById(sessionId);
      if (!session) throw AppError.notFound("SESSION_NOT_FOUND", "Payment session nahi mila.");
      if (!LIVE.includes(session.status)) return buildView(session);

      await db.updateSession(session.id, { status: "CANCELLED", failureReason: reason });
      await onClosed?.({ session, reason });
      await service.promoteNext(session.merchantId);
      return buildView((await db.findSessionById(session.id))!);
    },

    /** Slot khaali hua to agla QUEUED session ACTIVE karo (naya 5 min window). */
    async promoteNext(merchantId: string): Promise<SessionRow | null> {
      const [merchant, active, queued] = await Promise.all([
        db.getMerchant(),
        db.listSessionsByStatus(merchantId, "ACTIVE"),
        db.listSessionsByStatus(merchantId, "QUEUED"),
      ]);
      if (!merchant) return null;
      if (active.length >= Math.max(1, merchant.slotConcurrency)) return null;

      const next = queued[0];
      if (!next) return null;

      const order = await db.findOrderById(next.orderId);
      if (!order || order.status !== "PENDING_PAYMENT") {
        // Order beech me cancel/paid ho gaya — queue se hatao aur agla dekho.
        await db.updateSession(next.id, { status: "CANCELLED", failureReason: "ORDER_NOT_PAYABLE" });
        return service.promoteNext(merchantId);
      }

      await db.updateSession(next.id, {
        status: "ACTIVE",
        payExpiresAt: new Date(now().getTime() + merchant.payWindowSeconds * 1000),
      });
      return db.findSessionById(next.id);
    },

    /** Dual timers: 5 min pay window, 30 s verification window. */
    async runTimers(): Promise<{ expired: number; suspicious: number }> {
      const current = now();
      const expiredActive = await db.findExpiredActiveSessions(current);
      for (const session of expiredActive) {
        await db.updateSession(session.id, { status: "EXPIRED", failureReason: "PAY_WINDOW_ELAPSED" });
        await onClosed?.({ session, reason: "PAY_WINDOW_ELAPSED" });
        await releaseStockIfUnpaid(session.orderId);
        await service.promoteNext(session.merchantId);
      }

      const expiredProcessing = await db.findExpiredProcessingSessions(current);
      for (const session of expiredProcessing) {
        await db.updateSession(session.id, { status: "SUSPICIOUS", failureReason: "VERIFY_WINDOW_ELAPSED" });
        await onClosed?.({ session, reason: "VERIFY_WINDOW_ELAPSED" });
      }

      return { expired: expiredActive.length, suspicious: expiredProcessing.length };
    },

    /** Observer ne credit confirm kiya — yahi ek jagah hai jahan paisa "PAID" hota hai. */
    async settle(input: { sessionId: string; utr: string; senderVpa: string | null }): Promise<SessionRow> {
      const session = await db.findSessionById(input.sessionId);
      if (!session) throw AppError.notFound("SESSION_NOT_FOUND", "Payment session nahi mila.");
      if (session.status === "SUCCESS") return session;

      const order = await db.findOrderById(session.orderId);
      const merchant = await db.getMerchant();
      if (!order || !merchant) throw AppError.notFound("ORDER_NOT_FOUND", "Order ya merchant nahi mila.");

      await db.updateSession(session.id, {
        status: "SUCCESS",
        utr: input.utr,
        senderVpa: input.senderVpa,
        settledAt: now(),
        verifyExpiresAt: null,
        failureReason: null,
      });
      await db.setOrderStatus(order.id, "PAID");

      const settled = (await db.findSessionById(session.id))!;
      await service.promoteNext(session.merchantId);
      await onSettled?.({ session: settled, order, merchant, utr: input.utr });
      return settled;
    },

    /** Verification pending (cross-source confirm ka wait). */
    async markProcessing(sessionId: string, merchant: MerchantRow): Promise<SessionRow> {
      await db.updateSession(sessionId, {
        status: "PROCESSING",
        verifyExpiresAt: new Date(now().getTime() + merchant.verifyWindowSeconds * 1000),
      });
      return (await db.findSessionById(sessionId))!;
    },

    async markUnmatched(sessionId: string, reason: string): Promise<void> {
      await db.updateSession(sessionId, { status: "SUSPICIOUS", failureReason: reason });
    },
  };

  /** Expired order ka reserved stock wapas (rule #3) — sirf ek hi baar. */
  async function releaseStockIfUnpaid(orderId: string): Promise<void> {
    const order = await db.findOrderById(orderId);
    if (!order || order.status !== "PENDING_PAYMENT") return;
    const liveSessions = (await db.listSessionsForOrder(orderId)).filter((session) => LIVE.includes(session.status));
    if (liveSessions.length > 0) return; // dusra attempt abhi chal raha hai

    for (const item of order.items) {
      await db.incrementStock(item.productId, item.qty);
    }
    await db.setOrderStatus(order.id, "EXPIRED");
  }

  return service;
}

export type GatewayService = ReturnType<typeof createGatewayService>;
