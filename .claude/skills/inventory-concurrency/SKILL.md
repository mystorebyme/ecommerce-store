---
name: inventory-concurrency
description: Use when touching stock, cart, checkout, orders or anything that decrements or reserves inventory.
---

# Inventory concurrency

- Never read stock, compute in code, then write it back. Always one atomic statement:
  `UPDATE variants SET stock = stock - :qty WHERE id = :id AND stock >= :qty`. If affected rows is 0, return "out of stock".
- Add a database `CHECK (stock >= 0)` in `database/sql/constraints.sql` as a safety net.
- Reserve stock at checkout with an expiry. Release unpaid reservations in `release-expired-stock.scheduler.ts`. Convert the reservation to a final decrement only after verified payment.
- Multi-item orders: lock or update variants in a fixed order (sorted by id) inside one transaction to avoid deadlocks.
- Cart prices and availability are rechecked on the server at checkout.
- Required test: 100 parallel orders for 1 item, exactly 1 succeeds (`tests/integration/inventory-concurrency.test.ts`).
