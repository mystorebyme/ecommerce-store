-- Purpose: Admin settings (VPA), payment links, append-only audit log
--
--   psql "$DATABASE_URL" -f database/migrations/0003_payment_links_settings_audit.sql
--
-- Idempotent. Money = integer paise.

-- 1) Merchant settings jo VPA ke saath rehte hain -----------------------------
ALTER TABLE "MerchantAccount" ADD COLUMN IF NOT EXISTS "merchantCode" TEXT;

-- 2) Key/value settings (open-link limits, pending VPA, etc.) ------------------
CREATE TABLE IF NOT EXISTS "Setting" (
  "key"       TEXT PRIMARY KEY,
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3) Payment links — fixed amount ya open amount ------------------------------
CREATE TABLE IF NOT EXISTS "PaymentLink" (
  "id"             TEXT PRIMARY KEY,
  "token"          TEXT NOT NULL UNIQUE,           -- public URL me jaata hai (guess-proof)
  "kind"           TEXT NOT NULL,                  -- FIXED | OPEN
  "title"          TEXT NOT NULL,
  "note"           TEXT NOT NULL,                  -- UPI `tn` me jaata hai
  "amountPaise"    INTEGER,                        -- FIXED: locked amount; OPEN: NULL
  "minAmountPaise" INTEGER,                        -- OPEN only
  "maxAmountPaise" INTEGER,                        -- OPEN only
  "status"         TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | DISABLED
  "maxUses"        INTEGER NOT NULL DEFAULT 1000,
  "usedCount"      INTEGER NOT NULL DEFAULT 0,
  "expiresAt"      TIMESTAMP(3),
  "createdBy"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentLink_kind_check"  CHECK ("kind" IN ('FIXED','OPEN')),
  CONSTRAINT "PaymentLink_status_check" CHECK ("status" IN ('ACTIVE','DISABLED')),
  CONSTRAINT "PaymentLink_amount_check" CHECK (
    ("kind" = 'FIXED' AND "amountPaise" IS NOT NULL AND "amountPaise" > 0) OR
    ("kind" = 'OPEN'  AND "amountPaise" IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS "PaymentLink_status_idx" ON "PaymentLink" ("status");
CREATE INDEX IF NOT EXISTS "PaymentLink_createdAt_idx" ON "PaymentLink" ("createdAt");

-- 4) Append-only audit log ----------------------------------------------------
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"        TEXT PRIMARY KEY,
  "actor"     TEXT NOT NULL,      -- e.g. "admin:token"
  "action"    TEXT NOT NULL,      -- e.g. "settings.vpa.staged"
  "entity"    TEXT NOT NULL,      -- e.g. "merchant"
  "entityId"  TEXT,
  "before"    TEXT,               -- JSON snapshot (secrets kabhi nahi)
  "after"     TEXT,               -- JSON snapshot
  "ip"        TEXT,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx"     ON "AuditLog" ("action");

-- Append-only: UPDATE/DELETE roko (owner bhi na kar sake)
CREATE OR REPLACE FUNCTION "audit_log_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog append-only hai — % allowed nahi', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "AuditLog_no_update" ON "AuditLog";
CREATE TRIGGER "AuditLog_no_update" BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_append_only"();

-- 5) Order par link attribution ----------------------------------------------
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "linkId" TEXT;
CREATE INDEX IF NOT EXISTS "Order_linkId_idx" ON "Order" ("linkId");

-- 6) Defaults ----------------------------------------------------------------
INSERT INTO "Setting" ("key", "value") VALUES
  ('min_open_amount_paise', '100'),
  ('max_open_amount_paise', '5000000')
ON CONFLICT ("key") DO NOTHING;
