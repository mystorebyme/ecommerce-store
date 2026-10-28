# Payment security — self-hosted UPI gateway

> Purpose: paisa handle karne wale hisse ke security rules aur kya already implemented hai
> Scope: `apps/api/src/modules/gateway`, `apps/api/src/webhooks/observer.webhook.ts`, `merchant-webhook.service.ts`

## Non-negotiable rules

1. **Paisa confirm sirf bank proof se.** Browser ka koi response, redirect, ya "success" screen
   payment confirm nahi karta. Sirf observer ki credit entry (UTR ke saath) se `SUCCESS` hota hai.
2. **Amount client se nahi.** `POST /orders` sirf `{productId, qty}` leta hai; price DB se.
3. **Observer signature.** `HMAC_SHA256(rawBody, OBSERVER_SHARED_SECRET)`, timing-safe compare.
   Iske bina koi bhi "₹1,899 credited" bhej kar free order le sakta hai.
4. **Raw body.** Observer route `express.json()` se **pehle** `express.raw()` par mount hai —
   warna signature ka payload badal jaata hai.
5. **Dedupe.** `BankObservation`: unique `(deviceId, messageId)` + unique `(utr, amountPaise)`.
   Duplicate delivery se double settle nahi hota.
6. **Exact amount match.** Amount match na ho to kuch PAID nahi hota. Ambiguous amount + note
   se pehchan na ho → `SUSPICIOUS` (guess nahi).
7. **Cross-source verification.** Gmail/Messages/Manual akela confirm nahi kar sakta — 30 s ke
   andar dusra source chahiye. Sirf trusted Android SMS standalone confirm karta hai.
8. **Idempotency.** Order + session `Idempotency-Key` par; settle dobara chalao to side-effect
   (webhook) dobara nahi.
9. **Merchant webhook secret** sirf HMAC ke liye use hota hai; API kabhi wapas nahi bhejti
   (`webhookSecretSet: true` hi dikhta hai). Admin route `x-admin-token` se protected hai.
10. **Logs me PII nahi.** Card/UPI PIN hamare paas aate hi nahi. Logs me `sessionId`, `orderId`,
    `utr`, `requestId` — bas. Raw SMS me account number ho sakta hai, isliye `rawText` 500 chars
    tak trim hota hai aur DB me hi rehta hai (logs me nahi).
11. **Retention.** `BankObservation.rawText` 90 din baad purge (DPDP) — job Phase 1 me
    (`docs/04-data/data-retention.md`).

## Threat model

| Threat | Kaise roka |
|--------|-----------|
| Fake credit bhej kar free order | Observer HMAC signature + secret rotate |
| Client price tampering (₹1 bhej do) | Schema me amount field hi nahi; price DB se |
| Same amount ke do orders me galat attribution | Single active slot + `tn` reference + exact amount; ambiguous → SUSPICIOUS |
| Duplicate SMS (observer retry) | `(deviceId,messageId)` unique + verdict DUPLICATE |
| Same UTR dobara (replay) | `(utr, amountPaise)` unique; settle idempotent |
| Compromised Gmail account | Untrusted source → 2 sources chahiye |
| Oversell (quantity) | `UPDATE … WHERE stock >= qty` atomic, 0 rows = OUT_OF_STOCK |
| Refund/chargeback abuse | Refund manual (admin), `refundedPaise` DB CHECK ke saath |
| Webhook spoof (merchant side) | `x-youpi-signature` HMAC + `x-youpi-delivery-id` dedupe |
| QR screenshot sharing | Single-use session + 5 min TTL + slot queue |
| Brute force / bots | Rate limit observer + payment endpoints (Phase 1), `deviceId` allow-list |

## Kya baaki hai (live se pehle)

- [ ] Per-device observer keys (aaj ek shared secret hai) + rotate flow
- [ ] Rate limiting (observer ingest, `POST /payments`, `POST /orders`)
- [ ] Admin RBAC + audit log (kaun sa refund/merchant change kiya)
- [ ] `SUSPICIOUS`/`UNMATCHED` ke liye ops queue + daily reconciliation report
- [ ] Encryption at rest for `rawText` (pgcrypto ya app-level)
- [ ] Alerting: `VERIFY_WINDOW_ELAPSED`, webhook `FAILED`, observer signature failures spike
