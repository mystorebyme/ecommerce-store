# E-commerce store (India) — YouPI-style payments + storefront monorepo

> Purpose: Project intro, structure, aur chalane ke commands
> Status: Demo live → **https://youpi-payments-demo.vercel.app** · Asli payments (self-hosted UPI gateway: QR + bank observer + signed webhooks) → `apps/api` ✅ working

## 🔴 Live demo

**https://youpi-payments-demo.vercel.app**

| Screen | Link |
|--------|------|
| Overview / landing | [/](https://youpi-payments-demo.vercel.app/) |
| Merchant storefront | [/store/](https://youpi-payments-demo.vercel.app/store/) |
| Checkout (WhatsApp OTP → QR → timers) | [/checkout/](https://youpi-payments-demo.vercel.app/checkout/) |
| 5 outcome pages | [/outcomes/](https://youpi-payments-demo.vercel.app/outcomes/) |
| One-click demo pack | [/demo-pack/](https://youpi-payments-demo.vercel.app/demo-pack/) |
| Admin console (9 tabs) | [/admin/](https://youpi-payments-demo.vercel.app/admin/) |
| Integration docs | [/docs/](https://youpi-payments-demo.vercel.app/docs/) |

Client call ke liye 5-minute script: [`docs/12-demo/demo-suite.md`](docs/12-demo/demo-suite.md).

## Isme kya hai

| Folder | Kya hai | Status |
|--------|---------|--------|
| `apps/youpi-demo` | **Live, clickable payment-gateway demo** — store, checkout, QR, queue, observers, webhooks, admin console, integration docs (Next.js, static export, Vercel-ready) | ✅ Ready |
| `apps/web` | Customer storefront (Next.js) | 🚧 Placeholder |
| `apps/admin` | Admin panel (Next.js, alag subdomain) | 🚧 Placeholder |
| `apps/api` | **Asli backend** — orders (server price, atomic stock, idempotency) + self-hosted UPI gateway (single-use QR, single-slot FIFO queue, bank observers, signed merchant webhooks) (`/api/v1`) | ✅ Payments slice working |
| `packages/*` | Shared config, types, validation (zod), UI | 🚧 Placeholder |
| `database/` | Prisma schema, SQL constraints, migrations | 🚧 Placeholder |
| `docs/` | 00–11 design docs + `12-demo/` demo guide | 📄 Docs first |

## Demo app chalao

```bash
cd apps/youpi-demo
npm install
npm run dev      # http://localhost:3000
```

Routes: `/` overview · `/store` storefront · `/checkout` OTP + QR · `/outcomes` 5 outcome pages ·
`/demo-pack` one-click scenarios · `/admin` merchant console · `/docs` integration guide.

Sab kuch browser ke sandbox ledger par chalta hai — koi real paisa move nahi hota.

## Vercel par deploy (already deployed)

**Live URL:** https://youpi-payments-demo.vercel.app

Vercel project: `youpi-payments-demo` (`prj_1DGNyJiABA6izlyOHCdT0Crbywce`) — repo
`mystorebyme/ecommerce-store`, branch `arena/511a7f0c-ecommerce-store`, **Root Directory = `apps/youpi-demo`**,
framework Next.js, build `npm run build`, output `out`, koi env var nahi.

Kuch badal ke dobara deploy karna ho:

```bash
cd apps/youpi-demo
npx vercel --prod          # ya Vercel dashboard → Deployments → Redeploy
```

Ya GitHub repo import karke **Root Directory = `apps/youpi-demo`** set karo.
Build `npm run build`, output `out`, koi env var zaruri nahi.

Poora step-by-step: [`docs/12-demo/demo-suite.md`](docs/12-demo/demo-suite.md)

## Asli payments (real money) — YouPI self-hosted gateway

Demo (upar wala) **simulated** hai. Asli paisa lene wala code `apps/api` me hai — aur wahan
**koi payment gateway nahi** hai: paisa seedha **aapke apne UPI VPA** par aata hai, aur
verification bank observer (Android SMS / Gmail / Messages) se hoti hai. Zero platform fee.

```bash
# 1. DB + tables + merchant + products
docker compose up -d postgres
npm install && npm run prisma:generate
npx prisma migrate deploy --schema database/prisma/schema.prisma
psql "$DATABASE_URL" -f database/sql/constraints.sql
cp .env.example apps/api/.env      # MERCHANT_VPA, OBSERVER_SHARED_SECRET, ADMIN_API_TOKEN...
npx tsx database/seeds/seed.ts

# 2. API
npm run api:dev                    # http://localhost:4000/api/v1/health
npm run api:test                   # 46 tests (HTTP + HMAC, Postgres ki zarurat nahi)

# 3. Poora flow ek command me (order → QR → bank credit → webhook)
npx tsx scripts/observer-simulator.ts flow
```

Endpoints:

| Method | Path | Kya karta hai |
|--------|------|---------------|
| `POST` | `/api/v1/orders` | Order — price DB se, stock atomic, `Idempotency-Key` |
| `POST` | `/api/v1/payments` | Session + **single-use UPI QR** (ek VPA par ek ACTIVE slot, FIFO queue) |
| `GET` | `/api/v1/payments/:id` | Status + queue position + 5:00/0:30 timers |
| `POST` | `/api/v1/payments/:id/cancel` | Slot chhodo → agla buyer ACTIVE |
| `POST` | `/api/v1/observers/observations` | Bank credit (HMAC signed) → match → PAID |
| `POST` | `/api/v1/admin/merchant` | VPA + webhook config (`x-admin-token`) |

Kaise kaam karta hai (ek line): **QR aapke VPA par → buyer pay karta hai → bank SMS observer
bhejta hai → exact amount + UTR match → order PAID → merchant ko HMAC-signed webhook.**

Docs: [`docs/03-architecture/payment-flow.md`](docs/03-architecture/payment-flow.md) ·
[`docs/06-api/payment-status-api.md`](docs/06-api/payment-status-api.md) ·
[`docs/06-api/webhooks.md`](docs/06-api/webhooks.md) ·
[`docs/07-security/payment-security.md`](docs/07-security/payment-security.md) ·
[`docs/10-deployment/go-live-checklist.md`](docs/10-deployment/go-live-checklist.md)

## Kaam karne ka order

1. `AGENTS.md` → rules
2. `STRUCTURE.md` → folder tree + 14 critical engineering rules
3. `agent-guides/task-guide.md` → task-wise steps
4. `docs/` → design docs (requirement → architecture → data → UI → API → security)
5. `TASKS.md` → progress order

## Critical rules (short)

Paisa integer paise me · server price decide kare · stock atomic decrement · webhook raw body +
signature + event-id dedupe · payment sirf server se confirm · order idempotent · uploads presigned ·
queues BullMQ · validation `packages/validation` me.

## Docs

- `docs/00-overview` … `docs/11-maintenance` — product, architecture, data, UI, API, security, testing, devops
- `docs/12-demo/demo-suite.md` — demo app ka complete guide (demo script, Vercel deploy, asli API se jodna)
- `PROGRESS.md` — kya-kya ho gaya
- `DECISIONS.md` — architecture decisions
