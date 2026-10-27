-- Purpose: DB safety: CHECK stock >= 0, unique webhook_event_id, unique idempotency key
--
-- Prisma schema me jo constraints express nahi ho sakte, wo yahan raw SQL me hain.
-- `database/migrations/0001_init_payments.sql` ke saath apply karo (dono idempotent hain).

-- ---------------------------------------------------------------------------
-- 1. Stock kabhi negative na ho (sath me atomic decrement pattern)
-- ---------------------------------------------------------------------------
ALTER TABLE "Product"
  ADD CONSTRAINT "product_stock_non_negative" CHECK ("stock" >= 0);

ALTER TABLE "Product"
  ADD CONSTRAINT "product_price_positive" CHECK ("pricePaise" > 0);

-- ---------------------------------------------------------------------------
-- 2. Order / payment amounts: integer paise, 0 se bada
-- ---------------------------------------------------------------------------
ALTER TABLE "Order"
  ADD CONSTRAINT "order_amount_positive" CHECK ("amountPaise" > 0);

ALTER TABLE "Payment"
  ADD CONSTRAINT "payment_amount_positive" CHECK ("amountPaise" > 0);

ALTER TABLE "Payment"
  ADD CONSTRAINT "payment_refund_not_more_than_paid"
  CHECK ("refundedPaise" >= 0 AND "refundedPaise" <= "amountPaise");

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "order_item_qty_positive" CHECK ("qty" > 0),
  ADD CONSTRAINT "order_item_line_total_matches"
  CHECK ("lineTotalPaise" = "unitPricePaise" * "qty");

-- ---------------------------------------------------------------------------
-- 3. Idempotency + webhook dedupe (Prisma @unique bhi hai, ye belt-and-braces)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "order_idempotency_key_key"
  ON "Order" ("idempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "payment_idempotency_key_key"
  ON "Payment" ("idempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_event_provider_event_id_key"
  ON "WebhookEvent" ("provider", "eventId");

-- ---------------------------------------------------------------------------
-- 4. Atomic stock decrement — ye pattern hi use karna hai:
--    UPDATE "Product" SET stock = stock - $1 WHERE id = $2 AND stock >= $1;
--    affected rows = 0  =>  OUT_OF_STOCK (rollback)
--    Inventory module aane par yahi SQL `reservations` ke saath reuse hoga.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "payment_pending_lookup"
  ON "Payment" ("status", "expiresAt")
  WHERE "status" IN ('CREATED', 'PENDING');
