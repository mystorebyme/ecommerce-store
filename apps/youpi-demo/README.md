# YouPI Payments — Demo Suite (`apps/youpi-demo`)

A single, self-contained, **fully static** Next.js app that demonstrates the complete YouPI payment
experience end to end — storefront, WhatsApp OTP checkout, dynamic UPI QR, single-slot FIFO queue,
bank-observer verification, signed webhooks, outcome pages, merchant admin console and integration docs.

**Live:** https://youpi-payments-demo.vercel.app

> Everything runs in the browser against a seeded sandbox ledger. **No real money moves** and no bank,
> UPI or merchant account is connected.

## Run it

```bash
cd apps/youpi-demo
npm install
npm run dev          # http://localhost:3000
```

Production build (static export → `out/`):

```bash
npm run build
npx serve out        # or: npm start
```

## Deploy to Vercel

```bash
cd apps/youpi-demo
npx vercel --prod
```

Vercel auto-detects Next.js. Settings if prompted:

| Setting | Value |
| --- | --- |
| Root directory | `apps/youpi-demo` |
| Framework | Next.js |
| Build command | `npm run build` |
| Output directory | `out` |
| Install command | `npm install` |
| Env vars | none required for the demo |

Or import the Git repo and set **Root Directory = `apps/youpi-demo`**. Pushes to the connected
branch then deploy automatically.

## Routes

| Route | What it shows |
| --- | --- |
| `/` | Product overview with a live hero checkout |
| `/store` | Merchant storefront, cart drawer, coupons, pincode check |
| `/checkout` | WhatsApp OTP gate, amount + method, QR, dual timers, queue |
| `/outcomes` | Success / failed / suspicious / expired / cancelled pages |
| `/demo-pack` | One-click scenarios for a live client call |
| `/admin` | Merchant console: overview, payments, queue, observers, accounts, branding, webhooks, security, settings |
| `/docs` | Full integration guide, API, SDK, webhooks, errors, Vercel deploy, go-live checklist |

## How the sandbox state machine works

- `src/lib/store.tsx` — React context + reducer-less state machine. A 1-second ticker enforces the
  payment window (5:00), the verification window (0:30), expiry and FIFO promotion.
- `src/lib/hmac.ts` — dependency-free SHA-256 / HMAC-SHA256 so webhook signatures are *real* and can be
  verified live on `/admin/webhooks` (tick “tamper with the body” to see verification fail).
- `src/lib/webhook.ts` — payload builder, delivery log entries, raw HTTP request preview.
- `src/lib/seed.ts` — six days of seeded history so the admin console is never empty.
- State persists in `localStorage` and syncs across tabs (`storage` event). **Reset demo data** lives in
  the footer and in Admin → Settings.

### Amounts

Money is integer **paise** everywhere (`₹499.00 === 49900`). Rupees exist only in the format helpers
(`formatPaise`, `rupeesToPaise`).

## Replacing the sandbox with the real API

1. Keep the UI components; swap the context methods in `src/lib/store.tsx` for HTTP calls:
   `createSession` → `POST /api/v1/payments`, `checkPayment` → `GET /api/v1/payments/:id`,
   `cancelSession` → `POST /api/v1/payments/:id/cancel`.
2. Render the QR from the server (`qr_svg_url`) instead of generating it locally.
3. Drive timers from `pay_expires_at` / `verify_expires_at` returned by the API.
4. Feed the observer panel and webhook log from real endpoints (`/api/v1/admin/observers`,
   `/api/v1/admin/webhooks`).
5. Never trust browser state for money: fulfilment must react to the signed webhook only.

## Design notes

- Own brand system (ink/paper/brand-green, Sora + DM Sans) declared in `tailwind.config.ts`; no
  copied logos, photos or copy from any reference project.
- WCAG-minded: semantic landmarks, labelled inputs, visible focus rings, skip link, `prefers-reduced-motion`
  support, live-region-free status text (no aggressive announcements).
- Mobile-first: every table scrolls, every drawer is full-width, admin navigation is a scroll strip.
