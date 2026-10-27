# Webhooks — Razorpay

> Purpose: webhook contract, signature, dedupe aur retry behaviour
> Code: `apps/api/src/webhooks/razorpay.webhook.ts` · Rule doc: `apps/api/src/webhooks/README.md`

## Endpoint

```
POST https://api.<domain>/api/v1/webhooks/razorpay
```

Dashboard → **Webhooks** me add karo, aur secret wahan set karo (`.env` me `RAZORPAY_WEBHOOK_SECRET`).
⚠️ Ye **key secret nahi** — webhook ka apna secret hota hai.

## Subscribe karna zaroori events

| Event | Kya hota hai code me |
|-------|----------------------|
| `payment.captured` | Payment `PAID`, order `PAID`, UTR save |
| `order.paid` | Same (fallback — dono aayein to dedupe/status check bacha leta hai) |
| `qr_code.credited` | QR par paisa aaya → `PAID` |
| `payment.failed` | Payment `FAILED` + reason (`error_description`) |
| `qr_code.closed` | Payment `EXPIRED` |

`refund.*`, `settlement.*` abhi ignore hote hain (audit ke liye `WebhookEvent` table me save hote hain).

## Verification (server ka kaam)

1. `express.raw()` se body **raw Buffer** me aati hai (`express.json()` se PEHLE mount).
2. `HMAC_SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET) === x-razorpay-signature` (timing-safe compare).
3. Galat signature → `401 WEBHOOK_SIGNATURE_INVALID`, kuch process nahi hota.
4. `x-razorpay-event-id` ko `WebhookEvent.eventId` (unique) me insert — duplicate par `{ "status": "duplicate" }` + 200.
5. Amount match (`entity.amount === payment.amountPaise`) — mismatch par `409 ORDER_AMOUNT_MISMATCH`, payment PAID nahi.

## Responses

| Case | Status | Body |
|------|--------|------|
| Processed | 200 | `{ "status": "handled" }` |
| Ignored event | 200 | `{ "status": "ignored" }` |
| Duplicate delivery | 200 | `{ "status": "duplicate" }` |
| Bad signature | 401 | `{ "error": { "code": "WEBHOOK_SIGNATURE_INVALID" } }` |
| Amount mismatch | 409 | `{ "error": { "code": "ORDER_AMOUNT_MISMATCH" } }` |

Non-2xx par Razorpay retry karta hai (exponential backoff, 24h tak) — isliye dedupe zaroori hai.

## Local test

```bash
BODY='{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_TEST","order_id":"order_TEST","status":"captured","amount":49900,"method":"upi","captured_at":1793000000}}}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$RAZORPAY_WEBHOOK_SECRET" -hex | sed 's/^.* //')

curl -i -X POST localhost:4000/api/v1/webhooks/razorpay \
  -H 'content-type: application/json' \
  -H "x-razorpay-signature: $SIG" \
  -H 'x-razorpay-event-id: evt_local_1' \
  --data-raw "$BODY"
# → {"status":"handled"} ; dobara wahi command → {"status":"duplicate"}
```

Automated tests: `apps/api/src/webhooks/razorpay.webhook.test.ts` (asli HMAC, asli HTTP).

## Production hardening (baad me)

- Webhook queue (BullMQ) me daal kar 200 turant do; abhi processing inline hai (fast hai, par
  email/invoice/Shiprocket side-effects queue me jayenge — `notifications` module).
- `WebhookEvent.status = FAILED` par alert (Grafana/Sentry) — warna paisa aaya aur order pending reh gaya.
- Replay protection: `x-razorpay-event-id` ke saath `receivedAt` window check (24h ke baad wahi event id aaye to investigate).
