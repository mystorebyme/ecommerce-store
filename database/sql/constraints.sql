-- Purpose: DB safety: CHECK stock >= 0, unique webhook_event_id, unique idempotency key
--
-- Prisma schema me jo constraints express nahi ho sakte, wo yahan raw SQL me hain.
-- `npm run prisma:generate && npx prisma migrate deploy` ke baad chalao (idempotent).

-- ---------------------------------------------------------------------------
-- 1. Stock kabhi negative na ho + price positive
-- ---------------------------------------------------------------------------
ALTER TABLE "Product" ADD CONSTRAINT "product_stock_non_negative" CHECK ("stock" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "product_price_positive" CHECK ("pricePaise" > 0);

-- ---------------------------------------------------------------------------
-- 2. Amounts: integer paise, positive
-- ---------------------------------------------------------------------------
ALTER TABLE "Order" ADD CONSTRAINT "order_amount_positive" CHECK ("amountPaise" > 0);
ALTER TABLE "PaymentSession" ADD CONSTRAINT "session_amount_positive" CHECK ("amountPaise" > 0);
ALTER TABLE "BankObservation" ADD CONSTRAINT "observation_amount_positive" CHECK ("amountPaise" > 0);

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "order_item_qty_positive" CHECK ("qty" > 0),
  ADD CONSTRAINT "order_item_line_total_matches" CHECK ("lineTotalPaise" = "unitPricePaise" * "qty");

-- ---------------------------------------------------------------------------
-- 3. UPI semantics: UTR 12 digit numeric, reference short + uppercase
-- ---------------------------------------------------------------------------
ALTER TABLE "BankObservation"
  ADD CONSTRAINT "observation_utr_12_digits" CHECK ("utr" ~ '^[0-9]{9,18}$');

ALTER TABLE "PaymentSession"
  ADD CONSTRAINT "session_reference_format" CHECK ("reference" ~ '^[A-Z0-9]{6,20}$');

-- Ek order par ek waqt me sirf ek live session (ACTIVE/PROCESSING/QUEUED)
CREATE UNIQUE INDEX IF NOT EXISTS "one_live_session_per_order"
  ON "PaymentSession" ("orderId")
  WHERE "status" IN ('QUEUED', 'ACTIVE', 'PROCESSING');

-- Ek merchant (VPA) par concurrency se zyada ACTIVE slot nahi.
-- slotConcurrency default 1 => poore VPA par ek hi buyer QR scan kar sakta hai.
CREATE UNIQUE INDEX IF NOT EXISTS "one_active_slot_per_merchant"
  ON "PaymentSession" ("merchantId")
  WHERE "status" = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- 4. Idempotency + dedupe
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "order_idempotency_key_key" ON "Order" ("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "observation_utr_amount_key" ON "BankObservation" ("utr", "amountPaise");
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_id_key" ON "OutboundWebhook" ("deliveryId");

-- ---------------------------------------------------------------------------
-- 5. Atomic stock decrement (inventory rule #3):
--    UPDATE "Product" SET stock = stock - $1 WHERE id = $2 AND stock >= $1;
--    affected rows = 0  =>  OUT_OF_STOCK (rollback)
-- ---------------------------------------------------------------------------

-- 6. Timers ke liye fast scan
CREATE INDEX IF NOT EXISTS "session_timers"
  ON "PaymentSession" ("status", "payExpiresAt", "verifyExpiresAt");
CREATE INDEX IF NOT EXISTS "delivery_due"
  ON "OutboundWebhook" ("status", "nextAttemptAt");
