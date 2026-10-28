# Database — setup, migration, backup

> Stack: PostgreSQL 16 + Prisma (`database/prisma/schema.prisma`)
> Money: **integer paise** (`pricePaise`, `amountPaise`) — kabhi float nahi

## Setup (local, 60 seconds)

```bash
docker compose up -d postgres          # postgres://youpi:youpi@localhost:5432/youpi
npm install                            # root workspaces
npm run prisma:generate                # @prisma/client
npx prisma migrate deploy --schema database/prisma/schema.prisma
psql "$DATABASE_URL" -f database/sql/constraints.sql   # CHECK + unique indexes
npx tsx database/seeds/seed.ts         # merchant (MERCHANT_VPA) + 3 products
```

Prisma ki jagah raw SQL pasand ho to `database/migrations/0001_init_youpi_gateway.sql`
chalao — dono raste same tables banate hain.

## Migration

```bash
# schema.prisma badalne ke baad (dev)
npx prisma migrate dev --schema database/prisma/schema.prisma --name add_x

# production me (downtime-free ke liye expand/contract pattern)
npx prisma migrate deploy --schema database/prisma/schema.prisma
```

Rule: migration **forward-only**; column drop karna ho to pehle code se use hatao, ek release
baad me drop karo.

## Tables (is slice me)

| Table | Kya |
|-------|-----|
| `MerchantAccount` | aapka VPA, payee name, webhook URL/secret, pay + verify window |
| `Product` | sku, pricePaise, stock (CHECK >= 0) |
| `Order` | number, status, amountPaise, idempotencyKey (unique) |
| `OrderItem` | per line: unitPricePaise, qty, lineTotalPaise (CHECK lineTotal = unit × qty) |
| `PaymentSession` | har try: reference (QR ka `tn`), status, payExpiresAt, verifyExpiresAt, utr (unique) |
| `BankObservation` | observer credit: rawText, amountPaise, utr, source, deviceId (dedupe) |
| `OutboundWebhook` | merchant delivery: deliveryId (unique), payload, attempts, nextAttemptAt |

DB-level safety (raw SQL, `constraints.sql`):
- ek merchant par ek hi `ACTIVE` session (`one_active_slot_per_merchant`, partial unique index)
- ek order par ek live session (`one_live_session_per_order`)
- `(utr, amountPaise)` unique — same credit dobara process nahi hota

Baaki tables (`User`, `Address`, `Cart`, `Shipment`, `Invoice`, `AuditLog`, `Consent`…)
Phase 1 modules ke saath isi schema me add honge.

## Backup / restore

```bash
./database/scripts/backup.sh     # pg_dump → backups/youpi-<timestamp>.sql.gz
./database/scripts/restore.sh backups/youpi-2026-10-28.sql.gz
```

## Pitfalls (jo pehle bhi ho chuke hain)

- `prisma generate` bhoolna → runtime par "@prisma/client did not initialize yet".
- `constraints.sql` skip karna → negative stock, duplicate credits, aur do ACTIVE slots possible ho jaate hain.
- Amount rupees (float) me save karna → rounding bug; hamesha paise.
