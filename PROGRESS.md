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

- **Asli payments — YouPI self-hosted UPI gateway (`apps/api`)** ✅ (koi Razorpay/PayU nahi)
  - `POST /api/v1/orders`: price DB se, stock atomic decrement + rollback, `Idempotency-Key`
  - `POST /api/v1/payments`: session + **single-use UPI QR** (`upi://pay?pa=<aapka VPA>&am=&tn=`),
    vector SVG + data URL, **ek VPA par ek ACTIVE slot + FIFO queue** (position + promotion)
  - Dual server timers DB me: 5 min pay window, 30 s verify window (refresh/restart safe)
  - `POST /api/v1/observers/observations`: bank observer ingest — raw SMS parsing (HDFC/ICICI/SBI/
    Paytm/UPI-P2M formats), HMAC signature, `(deviceId,messageId)` + `(utr,amountPaise)` dedupe,
    exact-amount attribution, cross-source verification (Gmail/Messages ko 2nd proof chahiye)
  - Merchant webhook: HMAC-signed `payment.success` with delivery-id + 5-step retry backoff
  - `POST /api/v1/admin/merchant`: VPA/payee/webhook config (`x-admin-token`)
  - Prisma models: MerchantAccount, Product, Order, OrderItem, PaymentSession, BankObservation,
    OutboundWebhook + SQL constraints (single active slot, unique UTR, stock >= 0)
  - 46 tests (`npm run api:test`) — HTTP + asli HMAC, Postgres ki zarurat nahi
  - `scripts/observer-simulator.ts` — health / pay / flow / admin commands
  - Docs: payment-flow (observer setup ke saath), payment-status-api, webhooks, payment-security,
    go-live-checklist

## Next

- Phase 1 ke baaki modules: auth/users, addresses, cart, inventory (reservation), shipping, invoices, consents, audit-logs.
- Demo storefront (`apps/youpi-demo`) ko `apps/api` se jodna (asli QR + status polling) — abhi demo simulated hai.
- Rate limiting + RBAC admin routes + reconciliation scheduler.
- `docs/` ke placeholder files ko asli content se bharna (requirement → architecture → data → UI → API → security).

## 2026-10-28 — Real storefront (apps/web) + public catalog API

- **Public catalog:** `GET /api/v1/products` aur `/api/v1/products/:id` — sirf `active` products,
  price server se (client ka price kabhi trust nahi). Tests: 3 naye (55 total).
- **Storefront (`apps/web`)** pehli baar build hota hai: catalog home, product detail,
  checkout aur success page — sab asli API se.
- **Checkout (real money path):** form → `POST /orders` (`Idempotency-Key`) → `POST /payments`
  → QR (data URL) + reference + live countdown + FIFO queue badge → `GET /payments/:id` polling
  har 2s → `SUCCESS` par `/checkout/success` (status **server se**, browser ke claim se nahi).
- **Proxy:** `/api/[...path]` route handler server-side proxy — CORS ki zarurat nahi, `API_URL`
  browser me nahi jaata.
- **Dev tool:** `scripts/dev-api-memory.ts` — API bina Postgres (in-memory seed) chalane ke liye,
  sirf UI development ke liye (⚠️ persistence/real money nahi).
- Placeholder pages (`cart`, `account`, `auth`, `wishlist`, `search`, `policies`) ab valid screens
  hain ("Phase 2") — `next build` pass karta hai, koi dangling route nahi.
- Verified: `apps/web` `next build` ✅, `tsc --noEmit` ✅, end-to-end curl flow (order → QR →
  signed observer webhook → `SUCCESS` → success page) ✅, API `npm test` 55/55 ✅.

## 2026-10-28 — LIVE: API public on Vercel + Supabase Postgres

- **Supabase** project `youpi-gateway` (ap-south-1): 7 tables, CHECKs + partial unique indexes,
  merchant (`7073448140@ptsbi`) + 4 products seeded. DDL `database/migrations/0001_init_youpi_gateway.sql` se.
- **Vercel** project `youpi-gateway-api` → https://youpi-gateway-api.vercel.app/api/v1
  (functions: `api/index.ts` + `api/v1/[...path].ts`, install me `prisma generate`,
  `rhel-openssl-3.0.x` engine, daily cron).
- **DB fallback:** `DATABASE_URL` (aws-1 pooler) → `DATABASE_URL_FALLBACK` (aws-0 pooler);
  `/api/v1/health` me `dbHost` + `platform` dikhta hai.
- **Observer onboarding aasan:** `x-observer-token` (HMAC ke bina), plain-text SMS body,
  `deviceId`/`messageId` optional (server content-hash deta hai → dedupe safe). 2 naye tests (58 total).
- Docs: `docs/10-deployment/vercel.md` (links, env table, redeploy, test commands, observer setup).


## 2026-10-28 (2) — REAL STORE LIVE: ₹ payments seedha merchant VPA par

- **Storefront live:** https://youpi-store-front.vercel.app (project `youpi-store-front`,
  root `apps/web`, `API_URL=https://youpi-gateway-api.vercel.app`). Asli DB se 4 products,
  asli prices; browser se `/api/*` proxy hi chalta hai (API ka URL expose nahi).
- **API ab nested routes bhi serve karta hai:** Vercel filesystem routing nested catch-all ko
  sirf ek segment ke liye match karta tha (`/api/v1/payments/<id>` → platform 404). Fix:
  `vercel.json` rewrite `/api/v1/(.*)` → `/api/gateway?__rest=$1`, aur `api/gateway.ts`
  original path wapas jod kar Express ko deta hai (routing 100% Express me).
- **Build pipeline:** `postinstall` (sirf `VERCEL=1` par) → `prisma generate` + `api:bundle`
  (esbuild → `api/_lib/serverless.js`, `@prisma/client` external). Build command khaali hi
  rehta hai — custom build command par Vercel `api/` functions chhod kar "No entrypoint found"
  dene lagta tha.
- **Health (live):** `status:"ok"`, `merchantVpa:"7073448140@ptsbi"`,
  `dbHost:"aws-0-ap-south-1.pooler.supabase.com"` (fallback host chala), `platform:"serverless"`.
- **Verified live:** `GET /api/v1/products` (4), `GET /api/v1/products/prod_kurta`,
  storefront home + `/checkout?product=prod_kurta` (₹1,899, "Pay ₹1,899 with UPI").
- **Ab bacha:** bank-SMS observer phone par (auto-confirm), aur `MERCHANT_WEBHOOK_SECRET` /
  `PAY_WINDOW_SECONDS` / `VERIFY_WINDOW_SECONDS` env vars.

## 2026-10-28 (3) — Performance: Mumbai region + CDN caching + hop removal

- **Region `bom1` (Mumbai)** dono projects ke liye (`vercel.json` → `regions`) — pehle `iad1`
  (Washington) tha, isliye har request me India → US → Mumbai ka chakkar lagta tha.
- **Storefront:** `/` aur `/products` ab **ISR static** (30s), `s-maxage` + SWR; checkout 10s.
- **API:** catalog par `s-maxage=60, stale-while-revalidate=300`; sweep background me.
- **Ek hop kam:** `/api/*` ab edge rewrite se seedha API par jaata hai (storefront lambda nahi).
- **UI:** `(shop)/loading.tsx` skeleton + shimmer (`prefers-reduced-motion` respect),
  edge middleware hata diya, `_next/static` immutable, product page `generateMetadata`.
- Verified: `apps/web` build ✅ (home/products `○` static), `tsc` ✅, API tests 58/58 ✅,
  live health + catalog + product page + checkout page ✅.

### Perf round verify (live)

- Product pages ab **build par pre-render** (`generateStaticParams`) — pehla visitor bhi CDN se instant.
- Product page ka apna `<title>`/description (`generateMetadata`) — SEO + tab instant.
- `PUBLIC_WEB_URL` API env me store URL par set; API redeploy.
- Live proof: `GET /api/v1/health` → ok (bom1), storefront `/api/products` → JSON via **edge rewrite**
  (DB tak round-trip ~1 hop), `/products/prod_shirt` → `Linen Oversized Shirt` title, `/checkout` render ✅.

## 2026-10-28 (4) — ₹1 test product + ek-call checkout + admin board

- **₹1 test product** (`prod_test1`, SKU `TEST-001`, `pricePaise: 100`): catalog bootstrap
  boot par ek baar chalta hai — **sirf create**, maujood ho to price/stock bilkul nahi chhedta
  (`CATALOG_BOOTSTRAP=off` se band). Live DB me pehle request par apne aap ban jaata hai.
- **`POST /api/v1/checkout`**: order + UPI QR **ek hi round-trip** me (pehle frontend do call
  karta tha → ek network RTT + ek cold-start chance bacha). Invariants same: price server se,
  atomic stock, `Idempotency-Key` replay par naya QR nahi.
- **Storefront:** home par "₹1 ka test payment" CTA; payment status polling 2s → **1.5s**.
- **`/admin` board** (storefront ke andar, temporary): live sessions list + "Mark paid" (UTR)
  — token sirf `sessionStorage` me, server-side `x-admin-token` ke saath proxy hota hai.
- Verified locally (in-memory API + Next dev): ₹1 order → `amountPaise: 100` → UPI string
  `am=1.00`, replay par wahi session, admin confirm se `SUCCESS`. API tests **61/61** ✅,
  `tsc` (api+web) ✅.
