# Payment flow — order → UPI QR → webhook → paid

> Purpose: Asli (real money) payment ka end-to-end flow, code ke references ke saath
> Status: Implemented — `apps/api/src/modules/payments`

## Ek line me

Buyer order banata hai → server Razorpay par order + **single-use UPI QR** banata hai →
buyer QR scan karke pay karta hai → bank observer/Razorpay **verified webhook** bhejta hai →
tabhi payment `PAID` hota hai. Browser ka koi bhi response payment confirm nahi karta.

## Sequence

```
Buyer/Web                apps/api                        Razorpay              Bank/UPI
   |                        |                               |                     |
   |-- POST /orders ------->| products se price recompute    |                     |
   |   (Idempotency-Key)    | stock atomic decrement        |                     |
   |<-- order (₹5,097) -----|                               |                     |
   |                        |                               |                     |
   |-- POST /payments/intents { orderId } ----------------->|                     |
   |                        |-- POST /orders --------------->|                     |
   |                        |<-- order_xxx ------------------|                     |
   |                        |-- POST /qr-codes (single_use)->|                     |
   |                        |<-- qr_xxx + image_url --------|                     |
   |<-- QR + expiresAt -----|  (Payment = PENDING)          |                     |
   |                        |                               |                     |
   |-- buyer scans QR ------------------------------------->|-------------------->|
   |                        |                               |<-- ₹5,097 credited -|
   |                        |<== POST /webhooks/razorpay ===|                     |
   |                        |  HMAC verify → dedupe →       |                     |
   |                        |  amount match → PAID          |                     |
   |-- GET /payments/:id -->|                               |                     |
   |<-- status: PAID -------|                               |                     |
```

Poll (`GET /payments/:id`) sirf **dikhane** ke liye hai; wo bhi har call par provider se
verify karta hai (`listQrPayments`) — isliye webhook miss ho jaye to bhi paisa chhup nahi jaata.

## States

`Payment.status` (DB enum):

| Status | Kab | Kaun set karta hai |
|--------|-----|--------------------|
| `CREATED` | Provider order ban gaya, QR ban raha hai | `createIntent` |
| `PENDING` | QR ready, buyer scan kare | `attachQr` |
| `PAID` | Verified webhook ya server-side verify | webhook / `getStatus` safety net / `verifyCheckout` |
| `FAILED` | `payment.failed` webhook, QR create fail | webhook / `createIntent` |
| `EXPIRED` | TTL khatam, `qr_code.closed` | scheduler / webhook / `getStatus` |
| `PARTIALLY_REFUNDED` / `REFUNDED` | Refund ke baad | `refund` |

`Order.status`: `PENDING_PAYMENT` → `PAID` (webhook) → `REFUNDED` (full refund ke baad).

## Har step ka code

| Step | File |
|------|------|
| Order create (server price + atomic stock + idempotency) | `apps/api/src/modules/orders/orders.service.ts` |
| Payment intent + QR + status + verify + refund | `apps/api/src/modules/payments/payments.service.ts` |
| Attempt lifecycle (QR attach, expire, mark paid) | `apps/api/src/modules/payments/payment-attempts.service.ts` |
| Razorpay REST calls (orders, qr-codes, payments, refunds) | `apps/api/src/modules/payments/providers/razorpay.provider.ts` |
| Webhook (raw body, HMAC, dedupe) | `apps/api/src/webhooks/razorpay.webhook.ts` |
| Raw-body mount order | `apps/api/src/app.ts` |
| Expiry scheduler (60s) | `apps/api/src/server.ts` → `expireStale()` |
| DB schema | `database/prisma/schema.prisma` |

## Kyun per-order QR (amount se match nahi)

Do buyer bilkul same amount (₹499) pay karein to bank statement se pata nahi chalega
kaunsa payment kis order ka hai. Isliye har **attempt** ke liye alag QR id, aur matching
`provider_qr_id` / `provider_order_id` se hoti hai — amount sirf ek sanity check hai
(mismatch ho to `ORDER_AMOUNT_MISMATCH` aur payment PAID nahi hoti).

Detail: `docs/03-architecture/adr/ADR-0010-upi-qr-per-order.md`, `docs/04-data/payment-state-machine.md`.

## Idempotency

| Kahan | Key | Kaam |
|-------|-----|------|
| `POST /orders` | `Idempotency-Key` header (SHA-256 hash DB me) | Double click = ek hi order |
| `POST /payments/intents` | `Idempotency-Key` header | Double click = ek hi QR |
| Webhook | `x-razorpay-event-id` unique | Duplicate delivery = `{ status: "duplicate" }` |
| Refund | status check (`refundedPaise`) | Same refund dobara nahi |

## Local end-to-end test (test mode)

```bash
# 1. DB upar
docker compose up -d postgres
npm install && npm run prisma:generate
npx prisma migrate deploy --schema database/prisma/schema.prisma
npx tsx database/seeds/seed.ts          # 3 products

# 2. API (test keys .env me)
npm run api:dev

# 3. Order banao
curl -sX POST localhost:4000/api/v1/orders \
  -H 'content-type: application/json' -H 'idempotency-key: demo-order-1' \
  -d '{"customerName":"Aarav","customerPhone":"9876543210","items":[{"productId":"<id>","qty":1}]}'

# 4. Intent (QR milega)
curl -sX POST localhost:4000/api/v1/payments/intents \
  -H 'content-type: application/json' -H 'idempotency-key: demo-pay-1' \
  -d '{"orderId":"<order id>"}'
```

Ab Razorpay test mode me QR ko test UPI se pay karo (ya dashboard → Payments → simulate),
phir `GET /api/v1/payments/<id>` par status `PAID` dikhega.
