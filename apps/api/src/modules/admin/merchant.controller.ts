// Purpose: Merchant (apna VPA) configuration — admin token se protected.
//
// Ye endpoint hi gateway ko "live" karta hai: VPA, payee name, webhook URL + secret.
// Iske bina koi session nahi ban sakta (503 MERCHANT_NOT_CONFIGURED).

import type { Request, Response } from "express";
import type { Db, MerchantRow } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import type { MerchantConfigInput } from "@youpi/validation";

export interface AdminDeps {
  db: Db;
  adminToken: string;
}

function toPublic(merchant: MerchantRow) {
  return {
    id: merchant.id,
    name: merchant.name,
    vpa: merchant.vpa,
    payeeName: merchant.payeeName,
    webhookUrl: merchant.webhookUrl,
    // Secret kabhi wapas nahi bhejte — sirf "set hai ya nahi".
    webhookSecretSet: Boolean(merchant.webhookSecret),
    payWindowSeconds: merchant.payWindowSeconds,
    verifyWindowSeconds: merchant.verifyWindowSeconds,
  };
}

export function createAdminController({ db, adminToken }: AdminDeps) {
  function authorize(req: Request): void {
    const provided = req.header("x-admin-token");
    if (!adminToken) {
      throw AppError.unavailable("ADMIN_TOKEN_MISSING", "ADMIN_API_TOKEN set nahi hai — admin routes band hain.");
    }
    if (!provided || provided !== adminToken) {
      throw AppError.unauthorized("ADMIN_UNAUTHORIZED", "x-admin-token galat hai.");
    }
  }

  return {
    async getMerchant(req: Request, res: Response): Promise<void> {
      authorize(req);
      const merchant = await db.getMerchant();
      res.json({ data: merchant ? toPublic(merchant) : null });
    },

    async setMerchant(req: Request, res: Response): Promise<void> {
      authorize(req);
      const input = req.body as MerchantConfigInput;
      const merchant = await db.upsertMerchant({
        name: input.name,
        vpa: input.vpa,
        payeeName: input.payeeName,
        webhookUrl: input.webhookUrl ?? null,
        webhookSecret: input.webhookSecret ?? null,
        payWindowSeconds: input.payWindowSeconds,
        verifyWindowSeconds: input.verifyWindowSeconds,
      });
      res.json({ data: toPublic(merchant) });
    },
  };
}
