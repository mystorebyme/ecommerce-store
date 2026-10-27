# Webhooks (`apps/api/src/webhooks`)

Third-party callbacks yahan rehte hain — modules se alag, kyunki inko **raw body** chahiye.

## Rule (har webhook par)

1. `app.ts` me **`express.json()` se PEHLE** `express.raw({ type: "application/json" })` se mount karo.
2. Signature **raw body** par verify karo, apni API key secret se nahi — webhook secret se.
   - Razorpay: `HMAC_SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)` == `x-razorpay-signature`
3. `x-razorpay-event-id` ko DB me **unique** save karo (`WebhookEvent.eventId`).
   Duplicate delivery aayi to `{ status: "duplicate" }` + 200.
4. Turant 2xx do. Asli kaam (email, invoice, Shiprocket) queue/worker me jaata hai.
5. Payment status sirf yahan (ya server-side verify se) badalta hai — **browser response se kabhi nahi**.
6. Amount mismatch ho to PAID mat karo (`ORDER_AMOUNT_MISMATCH`) — alert bhejo.

## Endpoint

| Method | Path | Kya |
|--------|------|-----|
| `POST` | `/api/v1/webhooks/razorpay` | Razorpay events (payment.captured, payment.failed, qr_code.credited, qr_code.closed) |

## Local test (curl se, asli HMAC ke saath)

```bash
BODY='{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_TEST","order_id":"order_TEST","status":"captured","amount":49900,"method":"upi","captured_at":1730000000}}}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$RAZORPAY_WEBHOOK_SECRET" -hex | sed 's/^.* //')

curl -X POST http://localhost:4000/api/v1/webhooks/razorpay \
  -H 'content-type: application/json' \
  -H "x-razorpay-signature: $SIG" \
  -H 'x-razorpay-event-id: evt_local_1' \
  --data-raw "$BODY"
```

Pehli baar `{"status":"handled"}`, dobara same `event-id` → `{"status":"duplicate"}`.
Galat secret → `401 WEBHOOK_SIGNATURE_INVALID`.
