// Purpose: settings — admin se badalne wali cheezein (UPI VPA, open-link limits)
//
// Design rules (ADR-0012):
//   1. VPA **DB me** rehta hai, env me nahi — redeploy ke bina badal sakte ho.
//   2. Naya VPA pehle **PENDING** hota hai. Jab tak us VPA par **₹1 test payment**
//      confirm na ho, purana VPA hi live rehta hai (galat VPA par paisa jaana
//      ek disaster hai — isliye commit se pehle proof).
//   3. Har change **audit log** me append hota hai (kisne, kab, purana → naya).
//   4. Public limits (min/max open amount) 60s cache — har pay page par DB query nahi.

import { randomBytes } from "node:crypto";
import type { Db, MerchantRow } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";

export const SETTING_KEYS = {
  pendingVpa: "upi_vpa_pending",
  pendingPayeeName: "upi_vpa_pending_payee",
  pendingMerchantCode: "upi_vpa_pending_mc",
  pendingVpaAt: "upi_vpa_pending_at",
  minOpenAmountPaise: "min_open_amount_paise",
  maxOpenAmountPaise: "max_open_amount_paise",
} as const;

const DEFAULTS = {
  minOpenAmountPaise: 100,
  maxOpenAmountPaise: 5_000_000, // ₹50,000
};

export interface SettingsView {
  merchant: {
    name: string;
    vpa: string;
    payeeName: string;
    merchantCode: string | null;
    payWindowSeconds: number;
    verifyWindowSeconds: number;
  } | null;
  pendingVpa: string | null;
  pendingPayeeName: string | null;
  pendingMerchantCode: string | null;
  pendingSince: string | null;
  limits: { minAmountPaise: number; maxAmountPaise: number };
}

export interface AuditContext {
  actor: string;
  ip?: string | null;
  requestId?: string | null;
}

export interface SettingsService {
  view(): Promise<SettingsView>;
  /** Public limits — pay pages inhe padhte hain (60s cache). */
  limits(): Promise<{ minAmountPaise: number; maxAmountPaise: number }>;
  stageVpa(input: { vpa: string; payeeName?: string; merchantCode?: string }, ctx: AuditContext): Promise<SettingsView>;
  /** ₹1 test successful hone ke baad hi naya VPA live hota hai. */
  confirmPendingVpa(ctx: AuditContext): Promise<SettingsView>;
  cancelPendingVpa(ctx: AuditContext): Promise<SettingsView>;
  /**
   * ₹1 test settle hone par: agar session ka VPA pending VPA hi hai to use live karo.
   * Match na ho to `false` (koi change nahi).
   */
  promoteIfPendingMatches(vpa: string, ctx: AuditContext): Promise<boolean>;
  setLimits(input: { minAmountPaise: number; maxAmountPaise: number }, ctx: AuditContext): Promise<SettingsView>;
  invalidate(): void;
}

export function createSettingsService({ db, now = () => new Date() }: { db: Db; now?: () => Date }): SettingsService {
  let cache: { at: number; limits: { minAmountPaise: number; maxAmountPaise: number } } | null = null;
  const CACHE_MS = 60_000;

  async function requireMerchant(): Promise<MerchantRow> {
    const merchant = await db.getMerchant();
    if (!merchant) throw AppError.unavailable("MERCHANT_NOT_CONFIGURED", "Pehle merchant VPA set karo.");
    return merchant;
  }

  async function settingsMap(): Promise<Map<string, string>> {
    const rows = await db.getSettings();
    return new Map(rows.map((row) => [row.key, row.value]));
  }

  function toPaise(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
  }

  async function audit(record: {
    action: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
    ctx: AuditContext;
  }): Promise<void> {
    await db.appendAudit({
      actor: record.ctx.actor,
      action: record.action,
      entity: "merchant",
      entityId: record.entityId ?? null,
      before: record.before === undefined ? null : JSON.stringify(record.before),
      after: record.after === undefined ? null : JSON.stringify(record.after),
      ip: record.ctx.ip ?? null,
      requestId: record.ctx.requestId ?? null,
    });
  }

  const service: SettingsService = {
    invalidate() {
      cache = null;
    },

    async limits() {
      if (cache && Date.now() - cache.at < CACHE_MS) return cache.limits;
      const map = await settingsMap();
      const limits = {
        minAmountPaise: toPaise(map.get(SETTING_KEYS.minOpenAmountPaise), DEFAULTS.minOpenAmountPaise),
        maxAmountPaise: toPaise(map.get(SETTING_KEYS.maxOpenAmountPaise), DEFAULTS.maxOpenAmountPaise),
      };
      cache = { at: Date.now(), limits };
      return limits;
    },

    async view() {
      const [merchant, map, limits] = await Promise.all([db.getMerchant(), settingsMap(), service.limits()]);
      return {
        merchant: merchant
          ? {
              name: merchant.name,
              vpa: merchant.vpa,
              payeeName: merchant.payeeName,
              merchantCode: merchant.merchantCode ?? null,
              payWindowSeconds: merchant.payWindowSeconds,
              verifyWindowSeconds: merchant.verifyWindowSeconds,
            }
          : null,
        pendingVpa: map.get(SETTING_KEYS.pendingVpa) ?? null,
        pendingPayeeName: map.get(SETTING_KEYS.pendingPayeeName) ?? null,
        pendingMerchantCode: map.get(SETTING_KEYS.pendingMerchantCode) ?? null,
        pendingSince: map.get(SETTING_KEYS.pendingVpaAt) ?? null,
        limits,
      };
    },

    async stageVpa(input, ctx) {
      const merchant = await requireMerchant();
      if (input.vpa.toLowerCase() === merchant.vpa.toLowerCase()) {
        throw AppError.badRequest("VPA_UNCHANGED", "Ye VPA pehle se live hai.");
      }

      await db.setSetting(SETTING_KEYS.pendingVpa, input.vpa);
      await db.setSetting(SETTING_KEYS.pendingPayeeName, input.payeeName ?? merchant.payeeName);
      if (input.merchantCode) await db.setSetting(SETTING_KEYS.pendingMerchantCode, input.merchantCode);
      await db.setSetting(SETTING_KEYS.pendingVpaAt, now().toISOString());

      await audit({
        action: "settings.vpa.staged",
        entityId: merchant.id,
        before: { vpa: merchant.vpa, payeeName: merchant.payeeName, merchantCode: merchant.merchantCode ?? null },
        after: { vpa: input.vpa, payeeName: input.payeeName ?? merchant.payeeName, merchantCode: input.merchantCode ?? null },
        ctx,
      });

      service.invalidate();
      return service.view();
    },

    async confirmPendingVpa(ctx) {
      const merchant = await requireMerchant();
      const map = await settingsMap();
      const pending = map.get(SETTING_KEYS.pendingVpa);
      if (!pending) throw AppError.badRequest("NO_PENDING_VPA", "Koi pending VPA nahi hai.");

      const payeeName = map.get(SETTING_KEYS.pendingPayeeName) ?? merchant.payeeName;
      const merchantCode = map.get(SETTING_KEYS.pendingMerchantCode) ?? merchant.merchantCode ?? null;

      const updated = await db.updateMerchantProfile(merchant.id, { vpa: pending, payeeName, merchantCode });

      await db.deleteSetting(SETTING_KEYS.pendingVpa);
      await db.deleteSetting(SETTING_KEYS.pendingPayeeName);
      await db.deleteSetting(SETTING_KEYS.pendingMerchantCode);
      await db.deleteSetting(SETTING_KEYS.pendingVpaAt);

      await audit({
        action: "settings.vpa.activated",
        entityId: merchant.id,
        before: { vpa: merchant.vpa, payeeName: merchant.payeeName, merchantCode: merchant.merchantCode ?? null },
        after: { vpa: updated?.vpa ?? pending, payeeName, merchantCode },
        ctx,
      });

      service.invalidate();
      return service.view();
    },

    async cancelPendingVpa(ctx) {
      const merchant = await requireMerchant();
      const map = await settingsMap();
      const pending = map.get(SETTING_KEYS.pendingVpa);

      await db.deleteSetting(SETTING_KEYS.pendingVpa);
      await db.deleteSetting(SETTING_KEYS.pendingPayeeName);
      await db.deleteSetting(SETTING_KEYS.pendingMerchantCode);
      await db.deleteSetting(SETTING_KEYS.pendingVpaAt);

      await audit({
        action: "settings.vpa.cancelled",
        entityId: merchant.id,
        before: pending ? { pendingVpa: pending } : null,
        after: { pendingVpa: null },
        ctx,
      });

      service.invalidate();
      return service.view();
    },

    async promoteIfPendingMatches(vpa, ctx) {
      const map = await settingsMap();
      const pending = map.get(SETTING_KEYS.pendingVpa);
      if (!pending || pending.toLowerCase() !== vpa.toLowerCase()) return false;
      await service.confirmPendingVpa({ ...ctx, actor: ctx.actor || "system:verification" });
      // Activation ka apna audit entry — "kis test payment ne verify kiya" ka record.
      await audit({
        action: "settings.vpa.verified_by_test",
        entityId: null,
        before: null,
        after: { vpa: pending },
        ctx,
      });
      return true;
    },

    async setLimits(input, ctx) {
      const merchant = await requireMerchant();
      const before = await service.limits();

      await db.setSetting(SETTING_KEYS.minOpenAmountPaise, String(input.minAmountPaise));
      await db.setSetting(SETTING_KEYS.maxOpenAmountPaise, String(input.maxAmountPaise));

      await audit({
        action: "settings.limits.updated",
        entityId: merchant.id,
        before,
        after: { minAmountPaise: input.minAmountPaise, maxAmountPaise: input.maxAmountPaise },
        ctx,
      });

      service.invalidate();
      return service.view();
    },
  };

  return service;
}

/** Token helpers — payment links ke liye guess-proof public id. */
export function publicToken(bytes = 9): string {
  return randomBytes(bytes).toString("base64url");
}
