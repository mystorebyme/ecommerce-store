// Purpose: payments: Request/response handling

import type { Request, Response } from "express";
import type { PaymentsService } from "./payments.service";

export function createPaymentsController(service: PaymentsService) {
  return {
    async start(req: Request, res: Response): Promise<void> {
      const view = await service.start({ orderId: (req.body as { orderId: string }).orderId });
      res.status(201).json({ data: view });
    },
    async status(req: Request, res: Response): Promise<void> {
      res.json({ data: await service.status({ sessionId: req.params.id ?? "" }) });
    },
    async cancel(req: Request, res: Response): Promise<void> {
      res.json({ data: await service.cancel({ sessionId: req.params.id ?? "" }) });
    },
    async attempts(req: Request, res: Response): Promise<void> {
      res.json({ data: await service.attemptsForOrder(req.params.orderId ?? "") });
    },
  };
}
