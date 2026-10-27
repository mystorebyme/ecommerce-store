# PROGRESS.md

## Done

- **Folder structure v4** (Step 0) — poora tree placeholders ke saath.
- **Docs skeletons** (Step 1–11) — `docs/00-overview` se `docs/11-maintenance` tak files bani hui hain (content TODO).
- **Demo live on Vercel** — https://youpi-payments-demo.vercel.app (project `youpi-payments-demo`,
  root dir `apps/youpi-demo`, framework Next.js, static export, koi env var nahi)
- **Demo suite (new)** — `apps/youpi-demo`: ek chalta-hua, clickable payment demo
  - Storefront + cart + coupon + pincode check (`/store`)
  - WhatsApp OTP gate, dynamic UPI QR, 5:00 / 0:30 server-authoritative timers (`/checkout`)
  - Single-slot FIFO queue with live position + auto promotion (`/checkout`, `/admin/queue`)
  - Observer mesh (Android / Gmail / Messages) with matched / unmatched / amount-mismatch verdicts
  - Asli HMAC-SHA256 signed webhook deliveries + live verification + tamper test (`/admin/webhooks`)
  - 5 outcome pages (`/outcomes`), demo pack (`/demo-pack`), admin console (9 tabs), integration docs (`/docs`)
  - White-label branding with live preview and contrast-safe colour handling
  - Static export build (18 routes) — Vercel par bina server chalta hai
  - Guide: `docs/12-demo/demo-suite.md`, app README: `apps/youpi-demo/README.md`

- **Asli payments slice (real money) — `apps/api`** ✅
  - `POST /api/v1/orders`: price DB se (client se nahi), stock atomic decrement + rollback, `Idempotency-Key`
  - `POST /api/v1/payments/intents`: Razorpay order + **per-order single-use UPI QR**, 5 min TTL
  - `GET /api/v1/payments/:id`: status + server-side provider verify (missed webhook ka safety net)
  - `POST /api/v1/payments/:id/verify`: checkout HMAC verify → provider se `captured` confirm
  - `POST /api/v1/payments/:id/refund`: partial/full refund, DB CHECK ke saath
  - `POST /api/v1/webhooks/razorpay`: raw body + HMAC + `x-razorpay-event-id` dedupe + amount match
  - Provider adapter pattern (`PaymentProvider`) — Razorpay + fake (tests)
  - Prisma models (`Product`, `Order`, `OrderItem`, `Payment`, `WebhookEvent`) + SQL constraints
  - 29 tests (`npm run api:test`) — HTTP + asli HMAC, Postgres ki zarurat nahi
  - Docs: `payment-flow`, `payment-status-api`, `webhooks`, `payment-security`, `go-live-checklist`

## Next

- Phase 1 ke baaki modules: auth/users, addresses, cart, inventory (reservation), shipping, invoices, consents, audit-logs.
- Demo storefront (`apps/youpi-demo`) ko `apps/api` se jodna (asli QR + status polling) — abhi demo simulated hai.
- Rate limiting + RBAC admin routes + reconciliation scheduler.
- `docs/` ke placeholder files ko asli content se bharna (requirement → architecture → data → UI → API → security).
