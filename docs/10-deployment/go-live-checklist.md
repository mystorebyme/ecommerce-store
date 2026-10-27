# Go-live checklist — real payments

> Purpose: test mode se asli paisa lene tak ka step-by-step
> Owner: payments + ops · Estimated: 1 din technical + Razorpay KYC ka wait

## 0. Pehle ye samajh lo

Code test mode aur live mode me **bilkul same** hai. Sirf keys badalti hain. Isliye
pehle test mode me poora flow (order → QR → webhook → PAID → refund) chala lo, phir live.

## 1. Razorpay account + KYC

- [ ] Business account banao (PAN, GST, bank account, business proof)
- [ ] KYC approve hone ka wait (1–3 working days)
- [ ] Payment methods enable: **UPI QR** (zaroori), cards, netbanking
- [ ] Settlement account verify (paisa yahan aayega)

## 2. Test mode verify (asli code, test paisa)

- [ ] `RAZORPAY_KEY_ID=rzp_test_...`, `RAZORPAY_KEY_SECRET=...` `.env` me
- [ ] `RAZORPAY_WEBHOOK_SECRET` dashboard ke webhook secret ke barabar
- [ ] DB upar: `docker compose up -d postgres` → `prisma migrate deploy` → seed
- [ ] `npm run api:dev` → `GET /api/v1/health` → `{"status":"ok"}`
- [ ] Order → intent → QR render (image dikh raha hai)
- [ ] Test UPI se QR pay (ya dashboard se simulate) → `GET /payments/:id` = `PAID`
- [ ] `WebhookEvent` table me event `PROCESSED`
- [ ] Refund chalao → `REFUNDED` + order `REFUNDED`
- [ ] Negative tests: galat signature 401, duplicate event `duplicate`, amount mismatch 409

## 3. Webhook public URL

- [ ] API public HTTPS par deployed ho (webhook ke liye public URL chahiye — localhost nahi)
       Local test ke liye `ngrok http 4000` ya Cloudflare Tunnel use karo
- [ ] Razorpay dashboard → Webhooks → `https://api.<domain>/api/v1/webhooks/razorpay`
- [ ] Events: `payment.captured`, `payment.failed`, `order.paid`, `qr_code.credited`, `qr_code.closed`
- [ ] Secret `.env` me (server restart)
- [ ] Test event bhejo → 200 `handled` dashboard me dikhe

## 4. Live switch

- [ ] `RAZORPAY_KEY_ID=rzp_live_...` + live secret (test keys hatado)
- [ ] Webhook ka **live mode** secret alag hota hai — usse update karo
- [ ] `PAYMENT_TTL_SECONDS=300` (5 min) — QR ki `close_by` isi se
- [ ] `PUBLIC_WEB_URL` production domain
- [ ] ₹1 ka asli order khud karke dekho (UPI se), phir refund kar do
- [ ] Bank statement me credit match karo (UTR = `Payment.utr`)

## 5. Monitoring (live ke pehle din se)

- [ ] Alert: `WebhookEvent.status=FAILED` count > 0
- [ ] Alert: payments `PENDING` jo 10 min se purane hain
- [ ] Alert: webhook 401 spike (secret galat ya koi forge kar raha hai)
- [ ] Daily reconciliation: Razorpay settlement report vs `Payment` (paid, refunded, fees)
- [ ] Grafana/Sentry me `payment_paid`, `payment_failed`, `amount_mismatch` events

## 6. Legal / customer-facing

- [ ] Refund policy page live (Razorpay approval ke liye bhi chahiye)
- [ ] Terms + privacy (DPDP) pages live
- [ ] Invoice (GST) paid hone ke baad generate (Phase 1 `invoices` module)
- [ ] Failed payment ka support flow (WhatsApp/email + order number)

## 7. Rollback

- [ ] Live keys wapas test keys? **Nahi** — buyer paisa test mode me nahi jayega.
      Rollback = deploy previous release (`infra/scripts/deploy.sh`), keys same rehti hain.
- [ ] Kill switch: `PAYMENTS_DISABLED=true` (Phase 1) → `POST /payments/intents` 503,
      store par COD/contact option dikhe.
