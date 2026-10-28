# Payment flow — YouPI self-hosted UPI gateway

> Purpose: Asli (real money) payment ka end-to-end flow — **koi payment aggregator nahi**
> Status: Implemented — `apps/api/src/modules/gateway`

## Ek line me

Buyer order banata hai → server merchant ke **apne VPA** par ek single-use UPI QR banata hai →
buyer apne UPI app se pay karta hai → **bank observer** (Android SMS / Gmail / Messages) wo credit
padh kar gateway ko bhejta hai → gateway exact amount + UTR se session match karta hai → tabhi
`PAID` hota hai aur merchant ke server ko **HMAC-signed webhook** jaati hai.

Paisa kabhi hamare paas nahi aata. Sirf ek hi cheez matter karti hai: bank statement me credit
aur uska proof (UTR).

```
Buyer            Merchant server              YouPI gateway                 Bank / UPI app
  |                    |                          |                              |
  |-- add to cart ---->|                          |                              |
  |-- POST /orders --->| price DB se, stock atomic|                              |
  |<-- ₹3,798 ---------|                          |                              |
  |-- POST /payments --------------------------->|                              |
  |                    |                    single-slot FIFO queue                |
  |                    |                    ACTIVE → upi://pay?pa=<merchant VPA>  |
  |<-- QR + 5:00 timer -------------------------|                              |
  |-- scan & pay --------------------------------------------------------------->|
  |                                              |<-- SMS "Rs.3,798 credited..." |
  |                                              |    (Android observer, HMAC)   |
  |                                              |  exact amount + UTR match     |
  |                                              |  30 s verify window           |
  |                                              |  → SUCCESS                    |
  |                    |<-- signed webhook -------|                              |
  |-- GET /payments/:id → status SUCCESS --------|                              |
```

## Kyun "exact amount attribution" + queue

Ek VPA par do buyer same time pay karein aur dono ka amount same ho, to bank statement se
pata nahi chalega kaunsa paisa kis order ka hai. Isliye:

1. **Ek VPA par ek hi ACTIVE slot** (`slotConcurrency = 1`). Doosre buyer **QUEUED** rehte hain
   aur unhe live position dikhti hai. Slot khaali (paid / expired / cancel / suspicious) hote hi
   agla buyer apne naye 5-min window ke saath ACTIVE ho jaata hai.
2. Har session ka apna **reference** (`YP...`) hota hai jo QR ke `tn` (transaction note) me jaata hai —
   amount clash hone par note se pehchan hoti hai.
3. Match **exact amount** par hota hai; multiple candidates ho aur note se pehchan na ho to
   **guess nahi karte** → `SUSPICIOUS` (manual review).

ADR: `docs/03-architecture/adr/ADR-0010-upi-qr-per-order.md`.

## States

`PaymentSession.status`:

| Status | Kab | Kaun set karta hai |
|--------|-----|--------------------|
| `QUEUED` | Slot busy hai, FIFO me wait | `POST /payments` |
| `ACTIVE` | QR live, 5 min window | `POST /payments` / promotion / scheduler |
| `PROCESSING` | Credit match hua, cross-source confirm ka wait | observer ingest |
| `SUCCESS` | Verified credit (trusted source ya 2 sources) | observer ingest |
| `FAILED` | Buyer/system fail (manual) | admin |
| `EXPIRED` | 5 min nikal gaye | scheduler (`runTimers`, har 5 s) |
| `CANCELLED` | Buyer ne chhoda | `POST /payments/:id/cancel` |
| `SUSPICIOUS` | Amount ambiguous / verify window (30 s) timeout | observer ingest / scheduler |

`Order.status`: `PENDING_PAYMENT` → `PAID` (settle) → `EXPIRED` (pay window khatam, stock release).

## Dual server timers

| Timer | Value | Kahan | Kya hota hai |
|-------|-------|-------|--------------|
| Pay window | 300 s | `session.payExpiresAt` (DB) | Khatam → `EXPIRED`, stock wapas, agla buyer promote |
| Verify window | 30 s | `session.verifyExpiresAt` (DB) | Khatam → `SUSPICIOUS` (paisa aaya par proof adhoora) |

Timers **DB me** hain, browser me nahi. Isliye tab band karo, refresh karo, server restart karo —
countdown phir bhi sach bolta hai (`GET /payments/:id` har call par timers evaluate karta hai).

## Verification: trusted source vs cross-source

| Source | Akela confirm kar sakta hai? | Kyun |
|--------|------------------------------|------|
| `ANDROID_SMS` | ✅ haan | Registered device, bank ka asli SMS, raw text server par parse hota hai |
| `GMAIL` | ❌ nahi | Email forward ho sakta hai / spoof ho sakta hai → 2 source chahiye |
| `MESSAGES` | ❌ nahi | Same reason |
| `MANUAL` | ❌ nahi | Admin paste — 2 source chahiye |

`GMAIL`/`MESSAGES` case me pehla credit `PROCESSING` karta hai; **wahi UTR** dusre source se
aane par `SUCCESS` ho jaata hai (30 s ke andar). Isse ek compromised channel se paisa PAID
nahi ho sakta.

## Parsing (SMS → paise + UTR)

`apps/api/src/modules/gateway/sms-parser.ts` — formats jo handle hote hain:

```
Rs.1,899.00 credited to your a/c XX1234 on 28-10-26. UPI ref 412345678901.
INR 1,899 credited to HDFC Bank A/c XX1234 from RAHUL@OKAXIS. UPI:412345678901
Acct XX1234 credited: INR 1,299.00 (UPI/P2M/412345678901/aarav@oksbi)
```

Rules: **debit** message reject, UTR na mile to reject (guessing nahi), amount hamesha
integer paise me convert. Parsing server par hai — app update kiye bina rules sudhar sakte ho.

## Code map

| Kaam | File |
|------|------|
| Session + queue + timers + settle | `apps/api/src/modules/gateway/gateway.service.ts` |
| UPI string + vector QR | `apps/api/src/modules/gateway/gateway.qr.ts` |
| SMS parsing | `apps/api/src/modules/gateway/sms-parser.ts` |
| Observer matching + verification | `apps/api/src/modules/gateway/observers.service.ts` |
| Observer inbound webhook (raw body + HMAC) | `apps/api/src/webhooks/observer.webhook.ts` |
| Merchant outbound webhook + retries | `apps/api/src/modules/payments/merchant-webhook.service.ts` |
| Order create (server price, atomic stock) | `apps/api/src/modules/orders/orders.service.ts` |
| Merchant config (VPA) | `apps/api/src/modules/admin/merchant.controller.ts` |
| Timers ka loop (5 s) | `apps/api/src/server.ts` |
| Schema | `database/prisma/schema.prisma` |

## Observer setup (jo aapko ek baar karna hai)

Observer = wo cheez jo bank ka credit padh kar gateway ko batati hai. Teen practical raste:

| Rasta | Kaise | Kab |
|-------|-------|-----|
| **Android SMS app (recommended)** | Ek chhota Android app (`SmsReceiver`) merchant ke phone par; bank SMS aate hi `POST /api/v1/observers/observations` + `x-observer-signature` | 24×7, instant (~2 s), trusted source |
| **Gmail watcher** | Gmail filter (bank sender) → Apps Script / cron jo email body ko POST kare | Backup, 1–3 min delay, cross-source confirm |
| **Manual / simulator** | `npx tsx scripts/observer-simulator.ts pay <sessionId>` | Testing aur demo |

Sabhi observers wahi endpoint use karte hain, sirf `source`, `deviceId`, `messageId` badalte hain:

```bash
BODY='{"source":"ANDROID_SMS","deviceId":"merchant-phone-1","messageId":"sms-991","rawText":"Rs.1,899.00 credited to a/c XX4412. UPI ref 412345678901."}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$OBSERVER_SHARED_SECRET" -hex | sed 's/^.* //')"

curl -sX POST localhost:4000/api/v1/observers/observations \
  -H 'content-type: application/json' -H "x-observer-signature: $SIG" --data-raw "$BODY"
# → {"data":{"verdict":"SUCCESS", ...}}
```

`messageId` observer-side unique hona chahiye (SMS ka timestamp+hash) — isse duplicate delivery
dobara process nahi hoti.

## Local end-to-end (5 commands)

```bash
docker compose up -d postgres
npm install && npm run prisma:generate
npx prisma migrate deploy --schema database/prisma/schema.prisma
psql "$DATABASE_URL" -f database/sql/constraints.sql
npx tsx database/seeds/seed.ts        # merchant (MERCHANT_VPA) + 3 products
npm run api:dev                        # http://localhost:4000/api/v1/health
```

Phir `npx tsx scripts/observer-simulator.ts flow` — order → QR → credit → status SUCCESS,
aur terminal me webhook delivery ka record.
