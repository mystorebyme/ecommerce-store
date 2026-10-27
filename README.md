# E-commerce store (India) — YouPI-style payments + storefront monorepo

> Purpose: Project intro, structure, aur chalane ke commands
> Status: Demo live → **https://youpi-payments-demo.vercel.app** · Asli payments (Razorpay UPI QR + webhook) → `apps/api` ✅ working

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
| `apps/api` | **Asli backend** — orders (server price, atomic stock, idempotency) + Razorpay UPI QR payments + signed webhooks + refunds (`/api/v1`) | ✅ Payments slice working |
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

## Asli payments (real money) — kaise chalayein

Demo (upar wala) **simulated** hai. Asli paisa lene wala code `apps/api` me hai — Razorpay
ke test keys ke saath aaj hi chala sakte ho.

```bash
# 1. DB + tables + products
docker compose up -d postgres
npm install
npm run prisma:generate
npx prisma migrate deploy --schema database/prisma/schema.prisma
psql "$DATABASE_URL" -f database/sql/constraints.sql
npx tsx database/seeds/seed.ts

# 2. API (test keys .env me daalo — rzp_test_...)
cp apps/api/.env.example apps/api/.env
npm run api:dev          # http://localhost:4000/api/v1/health
npm run api:test         # 29 tests (HTTP + HMAC, DB ki zarurat nahi)
```

Flow (5 endpoints):

| Method | Path | Kya karta hai |
|--------|------|---------------|
| `POST` | `/api/v1/orders` | Order — price DB se, stock atomic, `Idempotency-Key` zaroori |
| `POST` | `/api/v1/payments/intents` | Razorpay order + **single-use UPI QR** (5 min TTL) |
| `GET` | `/api/v1/payments/:id` | Status (webhook miss ho to server-side verify) |
| `POST` | `/api/v1/payments/:id/verify` | Checkout (card/UPI app) ka HMAC verify |
| `POST` | `/api/v1/payments/:id/refund` | Refund (partial allowed) |
| `POST` | `/api/v1/webhooks/razorpay` | Raw body + HMAC + event-id dedupe → PAID |

Docs: [`docs/03-architecture/payment-flow.md`](docs/03-architecture/payment-flow.md) ·
[`docs/06-api/payment-status-api.md`](docs/06-api/payment-status-api.md) ·
[`docs/06-api/webhooks.md`](docs/06-api/webhooks.md) ·
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
