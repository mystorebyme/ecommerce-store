# Webhooks (`apps/api/src/webhooks`)

Third-party callbacks yahan rehte hain — modules se alag, kyunki inko **raw body** chahiye.

## Rule (har inbound webhook par)

1. `app.ts` me **`express.json()` se PEHLE** `express.raw({ type: "*/*" })` se mount karo.
2. Signature **raw body** par verify karo: `HMAC_SHA256(rawBody, sharedSecret)` == header
   (`x-observer-signature` me `sha256=<hex>`), timing-safe compare.
3. Message/delivery id ko DB me **unique** save karo (`BankObservation.deviceId+messageId`,
   `(utr, amountPaise)`), duplicate par 200 + verdict `DUPLICATE`.
4. Turant 2xx do. Asli kaam (notification, invoice) queue me jaata hai.
5. Paisa status **sirf** yahan aayi verified credit se badalta hai — browser response se kabhi nahi.

## Endpoints

| Method | Path | Kya |
|--------|------|-----|
| `POST` | `/api/v1/observers/observations` | Bank observer (Android SMS / Gmail / Messages) — credit entry |

Shiprocket tracking webhook Phase 1 me `shiprocket.webhook.ts` me aayega.

## Local test

```bash
BODY='{"source":"ANDROID_SMS","deviceId":"dev-1","messageId":"m-1","rawText":"Rs.1,899.00 credited to a/c XX4412. UPI ref 412345678901."}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$OBSERVER_SHARED_SECRET" -hex | sed 's/^.* //')"

curl -sX POST localhost:4000/api/v1/observers/observations \
  -H 'content-type: application/json' -H "x-observer-signature: $SIG" --data-raw "$BODY"
# → {"data":{"verdict":"SUCCESS"}} ; wahi dobara → DUPLICATE
```

Galat secret → `401 OBSERVER_SIGNATURE_INVALID`.

Full contract: `docs/06-api/webhooks.md`. Setup: `docs/03-architecture/payment-flow.md`
(Observer setup section). Simulator: `scripts/observer-simulator.ts`.
