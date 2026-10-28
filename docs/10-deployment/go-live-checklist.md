# Go-live checklist — real UPI payments (self-hosted)

> Purpose: local demo se asli paisa lene tak — zero platform fee, paisa aapke bank me
> Owner: you + ops · Total time: ~1 din (bank side ka kuch nahi, koi KYC/aggregator nahi)

## 0. Isme kya chahiye (aur kya nahi)

| Chahiye | Nahi chahiye |
|---------|--------------|
| Ek bank account + usi ka **UPI VPA** (personal ya current) | Razorpay/PayU/Cashfree account |
| Ek phone jo 24×7 on rahe (Android observer) | KYC / merchant onboarding |
| Public HTTPS API (webhook + observer ke liye) | Settlement cycle / platform fee |

⚠️ Business ke liye **current account + GST** recommend karte hain (invoices ke liye), par
technically personal account se bhi UPI receive hota hai.

## 1. VPA + secrets taiyar karo

```bash
cp .env.example apps/api/.env
```

`.env` me:

```
MERCHANT_VPA=yourstore@okhdfcbank      # QR isi par banega
MERCHANT_NAME=Your Store
PAYEE_NAME=Your Store                  # bank app me yahi dikhega
MERCHANT_WEBHOOK_URL=https://your-api.com/api/youpi/webhook
MERCHANT_WEBHOOK_SECRET=$(openssl rand -hex 24)
OBSERVER_SHARED_SECRET=$(openssl rand -hex 24)
ADMIN_API_TOKEN=$(openssl rand -hex 24)
PAY_WINDOW_SECONDS=300
VERIFY_WINDOW_SECONDS=30
```

## 2. DB + API deploy

```bash
docker compose up -d postgres
npm install && npm run prisma:generate
npx prisma migrate deploy --schema database/prisma/schema.prisma
psql "$DATABASE_URL" -f database/sql/constraints.sql
npx tsx database/seeds/seed.ts      # merchant + products
npm run api:build && npm start      # ya pm2/docker
curl -s https://your-api.com/api/v1/health
```

Checklist:
- [ ] `GET /health` → `merchantVpa` set, `observersEnabled: true`, `webhookDelivery: true`
- [ ] API public HTTPS par (observer bhi isi URL par POST karega)
- [ ] DB backup cron (`database/scripts/backup.sh`) daily
- [ ] Process manager (pm2/systemd) + restart on crash; timers 5 s par chalte rehne chahiye

## 3. Observer chalu karo (yahi asli "verification" hai)

- [ ] Android phone (merchant ka, 24×7 charging par) — SMS read permission
- [ ] App ka config: `API_URL`, `OBSERVER_SHARED_SECRET`, `deviceId` (unique naam)
- [ ] App sirf bank sender ke SMS padhe, body ko **raw** POST kare + `x-observer-signature`
- [ ] Deliverable `messageId` = SMS timestamp + hash (unique)
- [ ] Test: apne aap ko ₹1 bhejo → `BankObservation` row + `GET /payments/:id` me credit dikhe
- [ ] Backup observer: Gmail filter (bank sender) → Apps Script → same endpoint (source `GMAIL`)
- [ ] Simulator se pehle verify kar lo: `npx tsx scripts/observer-simulator.ts pay <sessionId>`

## 4. Merchant webhook endpoint

- [ ] `/api/youpi/webhook` banaya (raw body, HMAC verify, delivery-id dedupe)
- [ ] Amount match check: `event.amountPaise === order.amountPaise`
- [ ] Sirf tabhi order PAID mark karo
- [ ] `401` return karo galat signature par (delivery FAILED hoke retry hogi)
- [ ] Test: `curl` se khud ek signed delivery bhejo, phir failure simulate karke retry dekho

## 5. Paise ka asli test

- [ ] Store se ₹1 ka order (ya smallest product) khud karo
- [ ] QR scan → pay → SMS aaya?
- [ ] 2–5 s me `GET /payments/:id` → `SUCCESS` + `utr`
- [ ] Bank statement me credit + UTR match karo
- [ ] Merchant webhook delivered (`OutboundWebhook.status = DELIVERED`)
- [ ] Refund manual: UPI se wapas bhejo aur `order.status = REFUNDED` karo (admin route Phase 1)

## 6. Edge cases jo pehle din aayenge

- [ ] **Same amount, do buyers** → queue + `tn` note se pehchan (test me cover hai)
- [ ] **Buyer ne pay kiya par window expire ho gaya** → credit `UNMATCHED`/`SUSPICIOUS` → refund
      karo ya manually `SUCCESS` (admin tool Phase 1). Isliye pay window 5 min rakho aur UI me
      countdown dikhao.
- [ ] **SMS der se aaya (2 min)** → session tab tak `ACTIVE`/`EXPIRED` ho sakta hai; exact amount +
      UTR ka `BankObservation` record rehta hai, reconcile se settle karo.
- [ ] **Airtel/Jio SMS format badal gaya** → parser update karo (`sms-parser.ts` + test case).
- [ ] **Phone off / internet gaya** → Gmail observer backup; warna credit manual reconcile.

## 7. Monitoring (pehle din se)

- [ ] Alert: `SUSPICIOUS` sessions > 0
- [ ] Alert: `UNMATCHED` observations > 0 (paisa aaya, order nahi mila)
- [ ] Alert: webhook `FAILED` > 0
- [ ] Alert: observer ne 10 min se koi SMS nahi bheja (heartbeat — Phase 1)
- [ ] Daily: bank statement vs `PaymentSession` (paid, refunded) reconciliation report

## 8. Rollback / incidents

- [ ] Kill switch: `POST /payments` band karna ho to reverse proxy par block, ya `MERCHANT_VPA`
      khaali karke restart (503 `MERCHANT_NOT_CONFIGURED`) — buyers ko "try later" dikhe
- [ ] Deploy rollback: previous release (`infra/scripts/deploy.sh`), DB migration forward-only
- [ ] Paisa aaya par system down: bank statement se manually verify + `BankObservation` replay
      (`scripts/observer-simulator.ts pay` jaisa replay endpoint Phase 1 me)
