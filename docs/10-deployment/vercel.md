# Vercel deployment — live API (serverless)

> Status: **LIVE** · Project `youpi-gateway-api` · Region `iad1` (Washington DC)

## Links

| Kya | URL |
|-----|-----|
| API base | `https://youpi-gateway-api.vercel.app/api/v1` |
| Health | `https://youpi-gateway-api.vercel.app/api/v1/health` |
| Products | `https://youpi-gateway-api.vercel.app/api/v1/products` |
| Observer ingest | `POST https://youpi-gateway-api.vercel.app/api/v1/observers/observations` |
| Vercel dashboard | https://vercel.com/prakashs-projects-ad474173/youpi-gateway-api |

## Database (Supabase, Mumbai)

| Kya | Value |
|-----|-------|
| Project | `youpi-gateway` (ref `ateuapkfdbpwfzaoqfkh`, region `ap-south-1`) |
| Tables | `MerchantAccount`, `Product`, `Order`, `OrderItem`, `PaymentSession`, `BankObservation`, `OutboundWebhook` |
| Merchant | VPA `7073448140@ptsbi`, pay window 300s, verify window 30s |
| Connection | pooler `:6543` + `pgbouncer=true&connection_limit=1&sslmode=require` |

`DATABASE_URL` (primary `aws-1` pooler) fail ho to `DATABASE_URL_FALLBACK` (`aws-0` pooler)
automatically try hota hai — `/api/v1/health` me `dbHost` batata hai kaunsa chala.

## Environment variables (Vercel → Settings → Environment Variables)

| Key | Type | Kya |
|-----|------|-----|
| `DATABASE_URL` | sensitive | Supabase pooler URL |
| `DATABASE_URL_FALLBACK` | sensitive | doosra pooler host |
| `OBSERVER_SHARED_SECRET` | sensitive | observer token/HMAC secret |
| `ADMIN_API_TOKEN` | sensitive | admin endpoints (`x-admin-token`) |
| `MERCHANT_VPA` | plain | `7073448140@ptsbi` |
| `MERCHANT_NAME` / `PAYEE_NAME` | plain | QR me dikhne wala naam |
| `PUBLIC_WEB_URL` | plain | CORS origin (storefront) |
| `PAY_WINDOW_SECONDS` / `VERIFY_WINDOW_SECONDS` | plain | 300 / 30 |
| `NODE_ENV` | plain | `production` |

Secret ki value kabhi repo me nahi — sirf Vercel env aur `apps/api/.env` (gitignored).

## Serverless-specific baatein

- **Timers:** koi `setInterval` nahi. `autoSweep` har request par (5s me ek baar) expiry +
  webhook retry chalata hai. `vercel.json` me daily cron (`/api/v1/health`) bhi hai.
- **Raw body:** `api/v1/[...path].ts` me `bodyParser: false` — warna observer HMAC verify nahi hoti.
- **Prisma engine:** `binaryTargets = ["native", "rhel-openssl-3.0.x"]`; generate build step me.
- **Bundle, not TS tracing:** Vercel ka TypeScript compile workspace imports (`@youpi/validation`
  symlink) reliably trace nahi karta — lambda module-load par crash ho jaata tha
  (`FUNCTION_INVOCATION_FAILED`, koi error message nahi). Isliye build step esbuild se
  `api/_lib/serverless.js` (CJS, sirf `@prisma/client` external) banata hai aur entry use
  `require` karta hai. Crash ho to jawab me `BOOT_FAILED` + asli message aata hai.
- **Filesystem read-only** — koi local file upload/log nahi (S3/R2 baad me).

## Deploy / redeploy

Project settings (dashboard → Settings → Build & Development):

| Setting | Value |
|---------|-------|
| Framework | `Express` |
| Install command | `npm install --include=dev` |
| Build command | `npm run prisma:generate && npm run api:bundle` |

```bash
git push origin arena/511a7f0c-ecommerce-store     # code GitHub par
npx vercel --prod --cwd .                          # ya dashboard se Redeploy
```

Repo link hone par dashboard → Deployments → Redeploy se bhi ho jaata hai.

## Test checklist (deploy ke baad)

```bash
curl -s https://youpi-gateway-api.vercel.app/api/v1/health
# → {"status":"ok","gateway":"youpi-selfhosted","merchantVpa":"7073448140@ptsbi","dbHost":"aws-…pooler.supabase.com"}

curl -s https://youpi-gateway-api.vercel.app/api/v1/products
# → 4 products (kurta, shirt, co-ord, dupatta)
```

Agar `BOOT_FAILED` aaye to `DATABASE_URL` check karo; `dbHost: null` matlab dono host fail.

## Observer app kaise jodna hai

Simple SMS-forwarder app (jo HMAC nahi kar sakti) → **token mode**:

```
POST https://youpi-gateway-api.vercel.app/api/v1/observers/observations
Header: x-observer-token: <OBSERVER_SHARED_SECRET>
Header: content-type: text/plain
Body:   %sms%            (poora SMS text — server khud parse karta hai)
```

JSON bhej sakte ho to:

```json
{ "source": "ANDROID_SMS", "deviceId": "store-phone", "messageId": "unique-id", "rawText": "Rs 1,899 credited … UTR 412345678901" }
```

`deviceId`/`messageId` optional hain — na do to server hash bana leta hai (dedupe phir bhi kaam karta hai).
