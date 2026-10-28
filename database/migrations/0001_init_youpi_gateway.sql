-- Purpose: Init migration — YouPI self-hosted gateway (catalog, orders, sessions, observers, webhooks)
--
--   psql "$DATABASE_URL" -f database/migrations/0001_init_youpi_gateway.sql
--   psql "$DATABASE_URL" -f database/sql/constraints.sql
--
-- Idempotent: dubara chalane se kuch nahi tootega.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN CREATE TYPE "OrderStatus" AS ENUM
  ('PENDING_PAYMENT','PAID','CANCELLED','EXPIRED','REFUNDED','FULFILLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "SessionStatus" AS ENUM
  ('QUEUED','ACTIVE','PROCESSING','SUCCESS','FAILED','EXPIRED','CANCELLED','SUSPICIOUS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "ObservationSource" AS ENUM ('ANDROID_SMS','GMAIL','MESSAGES','MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "ObservationStatus" AS ENUM
  ('RECEIVED','MATCHED','DUPLICATE','UNMATCHED','SUSPICIOUS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING','DELIVERED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "MerchantAccount" (
  "id"                  TEXT PRIMARY KEY,
  "name"                TEXT NOT NULL,
  "vpa"                 TEXT NOT NULL UNIQUE,
  "payeeName"           TEXT NOT NULL,
  "webhookUrl"          TEXT,
  "webhookSecret"       TEXT,
  "payWindowSeconds"    INTEGER NOT NULL DEFAULT 300,
  "verifyWindowSeconds" INTEGER NOT NULL DEFAULT 30,
  "slotConcurrency"     INTEGER NOT NULL DEFAULT 1,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS "PaymentSession" (
  "id"              TEXT PRIMARY KEY,
  "orderId"         TEXT NOT NULL REFERENCES "Order"("id"),
  "merchantId"      TEXT NOT NULL REFERENCES "MerchantAccount"("id"),
  "amountPaise"     INTEGER NOT NULL,
  "currency"        TEXT NOT NULL DEFAULT 'INR',
  "status"          "SessionStatus" NOT NULL DEFAULT 'QUEUED',
  "reference"       TEXT NOT NULL UNIQUE,
  "upiString"       TEXT NOT NULL,
  "vpa"             TEXT NOT NULL,
  "queuePosition"   INTEGER NOT NULL DEFAULT 0,
  "payExpiresAt"    TIMESTAMP(3) NOT NULL,
  "verifyExpiresAt" TIMESTAMP(3),
  "utr"             TEXT UNIQUE,
  "method"          TEXT DEFAULT 'upi',
  "senderVpa"       TEXT,
  "failureReason"   TEXT,
  "settledAt"       TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PaymentSession_orderId_idx" ON "PaymentSession" ("orderId");
CREATE INDEX IF NOT EXISTS "PaymentSession_merchant_status_idx" ON "PaymentSession" ("merchantId", "status");

CREATE TABLE IF NOT EXISTS "BankObservation" (
  "id"          TEXT PRIMARY KEY,
  "source"      "ObservationSource" NOT NULL,
  "deviceId"    TEXT NOT NULL,
  "messageId"   TEXT NOT NULL,
  "rawText"     TEXT NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "utr"         TEXT NOT NULL,
  "senderVpa"   TEXT,
  "bankName"    TEXT,
  "direction"   TEXT NOT NULL DEFAULT 'CREDIT',
  "observedAt"  TIMESTAMP(3) NOT NULL,
  "status"      "ObservationStatus" NOT NULL DEFAULT 'RECEIVED',
  "sessionId"   TEXT REFERENCES "PaymentSession"("id"),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("utr", "amountPaise"),
  UNIQUE ("deviceId", "messageId")
);
CREATE INDEX IF NOT EXISTS "BankObservation_sessionId_idx" ON "BankObservation" ("sessionId");
CREATE INDEX IF NOT EXISTS "BankObservation_status_idx" ON "BankObservation" ("status");

CREATE TABLE IF NOT EXISTS "OutboundWebhook" (
  "id"             TEXT PRIMARY KEY,
  "merchantId"     TEXT NOT NULL REFERENCES "MerchantAccount"("id"),
  "event"          TEXT NOT NULL,
  "paymentId"      TEXT NOT NULL,
  "orderId"        TEXT NOT NULL,
  "deliveryId"     TEXT NOT NULL UNIQUE,
  "url"            TEXT NOT NULL,
  "payload"        JSONB NOT NULL,
  "status"         "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "lastStatusCode" INTEGER,
  "lastError"      TEXT,
  "nextAttemptAt"  TIMESTAMP(3) NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt"    TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "OutboundWebhook_pending_idx" ON "OutboundWebhook" ("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "OutboundWebhook_payment_idx" ON "OutboundWebhook" ("paymentId");
