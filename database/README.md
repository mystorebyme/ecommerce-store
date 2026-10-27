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
npx tsx database/seeds/seed.ts         # 3 products (₹1,899 / ₹1,299 / ₹749)
```

Prisma ki jagah raw SQL pasand ho to `database/migrations/0001_init_payments.sql` chalao —
dono raste same tables banate hain.

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
| `Product` | sku, pricePaise, stock (CHECK >= 0) |
| `Order` | number, status, amountPaise, idempotencyKey (unique) |
| `OrderItem` | per line: unitPricePaise, qty, lineTotalPaise (CHECK lineTotal = unit × qty) |
| `Payment` | har attempt: providerOrderId, providerQrId, status, utr, refundedPaise |
| `WebhookEvent` | eventId (unique), type, payload, status — dedupe ka core |

Baaki tables (`User`, `Address`, `Cart`, `Shipment`, `Invoice`, `AuditLog`, `Consent`…)
Phase 1 modules ke saath isi schema me add honge.

## Backup / restore

```bash
./database/scripts/backup.sh     # pg_dump → backups/youpi-<timestamp>.sql.gz
./database/scripts/restore.sh backups/youpi-2026-10-28.sql.gz
```

## Pitfalls (jo pehle bhi ho chuke hain)

- `prisma generate` bhoolna → runtime par "@prisma/client did not initialize yet".
- `constraints.sql` skip karna → negative stock / duplicate webhook possible ho jaata hai.
- Amount rupees (float) me save karna → rounding bug; hamesha paise.
