-- Purpose: Pehla migration — catalog + order + payment + webhook dedupe
--
-- Do tareeke se apply kar sakte ho:
--   1) `pnpm --dir apps/api exec prisma migrate deploy`  (Prisma schema se)
--   2) `psql "$DATABASE_URL" -f database/migrations/0001_init_payments.sql`
--      phir `database/sql/constraints.sql` chala do.
-- Dono idempotent hain (IF NOT EXISTS), dubara chalane se kuch nahi tootega.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM
    ('PENDING_PAYMENT','PAID','CANCELLED','EXPIRED','REFUNDED','PARTIALLY_REFUNDED','FULFILLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM
    ('CREATED','PENDING','PAID','FAILED','EXPIRED','REFUNDED','PARTIALLY_REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED','PROCESSED','IGNORED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Product" (
  "id"         TEXT PRIMARY KEY,
  "sku"        TEXT NOT NULL UNIQUE,
  "name"       TEXT NOT NULL,
  "pricePaise" INTEGER NOT NULL,
  "stock"      INTEGER NOT NULL DEFAULT 0,
  "active"     BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Product_active_idx" ON "Product" ("active");

CREATE TABLE IF NOT EXISTS "Order" (
  "id"             TEXT PRIMARY KEY,
  "number"         TEXT NOT NULL UNIQUE,
  "status"         "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "amountPaise"    INTEGER NOT NULL,
  "currency"       TEXT NOT NULL DEFAULT 'INR',
  "customerName"   TEXT NOT NULL,
  "customerPhone"  TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order" ("status");
CREATE INDEX IF NOT EXISTS "Order_customerPhone_idx" ON "Order" ("customerPhone");

CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id"             TEXT PRIMARY KEY,
  "orderId"        TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
  "productId"      TEXT NOT NULL REFERENCES "Product"("id"),
  "sku"            TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "unitPricePaise" INTEGER NOT NULL,
  "qty"            INTEGER NOT NULL,
  "lineTotalPaise" INTEGER NOT NULL,
  UNIQUE ("orderId", "productId")
);
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem" ("orderId");

CREATE TABLE IF NOT EXISTS "Payment" (
  "id"                TEXT PRIMARY KEY,
  "orderId"           TEXT NOT NULL REFERENCES "Order"("id"),
  "provider"          TEXT NOT NULL DEFAULT 'razorpay',
  "providerOrderId"   TEXT NOT NULL,
  "providerQrId"      TEXT,
  "qrString"          TEXT,
  "qrImageUrl"        TEXT,
  "amountPaise"       INTEGER NOT NULL,
  "currency"          TEXT NOT NULL DEFAULT 'INR',
  "status"            "PaymentStatus" NOT NULL DEFAULT 'CREATED',
  "method"            TEXT,
  "providerPaymentId" TEXT,
  "utr"               TEXT,
  "failureReason"     TEXT,
  "refundedPaise"     INTEGER NOT NULL DEFAULT 0,
  "idempotencyKey"    TEXT NOT NULL UNIQUE,
  "expiresAt"         TIMESTAMP(3) NOT NULL,
  "paidAt"            TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Payment_orderId_idx" ON "Payment" ("orderId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment" ("status");
CREATE INDEX IF NOT EXISTS "Payment_providerOrderId_idx" ON "Payment" ("providerOrderId");

CREATE TABLE IF NOT EXISTS "WebhookEvent" (
  "id"          TEXT PRIMARY KEY,
  "provider"    TEXT NOT NULL DEFAULT 'razorpay',
  "eventId"     TEXT NOT NULL UNIQUE,
  "eventType"   TEXT NOT NULL,
  "payload"     JSONB NOT NULL,
  "status"      "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
  "error"       TEXT,
  "receivedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "WebhookEvent_provider_eventType_idx"
  ON "WebhookEvent" ("provider", "eventType");
