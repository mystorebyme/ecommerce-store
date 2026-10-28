// Purpose: payments: Business logic
//
// Gateway (YouPI self-hosted) ke upar patla wrapper — client ko ek hi jagah se
// payment lifecycle milta hai:
//   start   → order ke liye session + single-use UPI QR (queue ho to position)
//   status  → live view (timers DB se, browser band ho to bhi sahi)
//   cancel  → buyer ne chhod diya, slot agle buyer ko
//
// Paisa confirm karne ka koi "client" rasta hai hi nahi — wo sirf observer
// (`/observers/observations`) se hota hai.

import type { Db } from "../../config/db";
import type { GatewayService, SessionView } from "../gateway/gateway.service";
import { AppError } from "../../middlewares/error.middleware";

export interface PaymentsDeps {
  db: Db;
  gateway: GatewayService;
}

export function createPaymentsService({ db, gateway }: PaymentsDeps) {
  return {
    start(input: { orderId: string }): Promise<SessionView> {
      return gateway.startForOrder({ orderId: input.orderId });
    },

    status(input: { sessionId: string }): Promise<SessionView> {
      return gateway.getView(input.sessionId);
    },

    cancel(input: { sessionId: string }): Promise<SessionView> {
      return gateway.cancel(input.sessionId);
    },

    /** Order ke saare attempts (buyer ko history dikhane ke liye). */
    async attemptsForOrder(orderId: string): Promise<{ sessionId: string; status: string; utr: string | null; createdAt: string }[]> {
      const order = await db.findOrderById(orderId);
      if (!order) throw AppError.notFound("ORDER_NOT_FOUND", "Order nahi mila.");
      const sessions = await db.listSessionsForOrder(orderId);
      return sessions.map((session) => ({
        sessionId: session.id,
        status: session.status,
        utr: session.utr,
        createdAt: session.createdAt.toISOString(),
      }));
    },
  };
}

export type PaymentsService = ReturnType<typeof createPaymentsService>;
