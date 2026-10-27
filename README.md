# E-commerce store (India) — YouPI-style payments + storefront monorepo

> Purpose: Project intro, structure, aur chalane ke commands
> Status: Demo suite ready (`apps/youpi-demo`); baaki modules placeholder hain

## Isme kya hai

| Folder | Kya hai | Status |
|--------|---------|--------|
| `apps/youpi-demo` | **Live, clickable payment-gateway demo** — store, checkout, QR, queue, observers, webhooks, admin console, integration docs (Next.js, static export, Vercel-ready) | ✅ Ready |
| `apps/web` | Customer storefront (Next.js) | 🚧 Placeholder |
| `apps/admin` | Admin panel (Next.js, alag subdomain) | 🚧 Placeholder |
| `apps/api` | Backend API (Node + Express + Prisma, `/api/v1`) | 🚧 Placeholder |
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

## Vercel par deploy

```bash
cd apps/youpi-demo
npx vercel --prod
```

Ya GitHub repo import karke **Root Directory = `apps/youpi-demo`** set karo.
Build `npm run build`, output `out`, koi env var zaruri nahi.

Poora step-by-step: [`docs/12-demo/demo-suite.md`](docs/12-demo/demo-suite.md)

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
