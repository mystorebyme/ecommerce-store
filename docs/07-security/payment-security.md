# Payment security

> Purpose: paisa handle karne wale hisse ke security rules aur kya already implemented hai
> Scope: `apps/api/src/modules/payments`, `apps/api/src/webhooks`

## Non-negotiable rules

1. **Key secret sirf server par.** Browser ko sirf `RAZORPAY_KEY_ID` (public) jaata hai.
   `.env` git me nahi (`.gitignore` me hai), `.env.example` me sirf naam.
2. **Amount client se nahi.** `POST /orders` sirf `{productId, qty}` leta hai; price DB se.
   Client ka diya amount kabhi use nahi hota (rule #2).
3. **Payment confirm server-side.** Browser ke redirect / checkout response par trust nahi.
   `PAID` sirf (a) verified webhook se, ya (b) `verifyCheckout` (HMAC + provider fetch), ya
   (c) `getStatus` ka server-side provider lookup.
4. **Webhook raw body + HMAC.** `express.raw()` `express.json()` se pehle; `timingSafeEqual`
   se compare; galat signature = 401 aur zero side-effects.
5. **Amount match.** Webhook/verify me `entity.amount === payment.amountPaise`, warna
   `ORDER_AMOUNT_MISMATCH` — mismatched paisa order me settle nahi hota.
6. **Idempotency.** Order aur intent dono `Idempotency-Key` par; webhook `eventId` par.
   Iske bina double click = double order, aur retry = double refund.
7. **Refund guard.** Refund sirf `PAID`/`PARTIALLY_REFUNDED` par, `refundedPaise <= amountPaise`
   (DB CHECK constraint bhi hai).
8. **Logs me PII/secret nahi.** Card/UPI details hamare server par aate hi nahi (Razorpay hosted).
   Logs me `paymentId`, `orderId`, `requestId` — bas.
9. **CORS allow-list.** Sirf `PUBLIC_WEB_URL` ko allow (wildcard nahi), `credentials: true`.
10. **Rate limit** (`middlewares/rate-limit.middleware.ts`, Phase 1): per IP + per phone,
    especially `/orders`, `/payments/intents`, `/payments/:id/verify`.

## Threat model (payments)

| Threat | Kaise roka |
|--------|-----------|
| Client price tampering (₹1 bhej do) | Schema me amount field hi nahi; price DB se |
| Replayed checkout response | HMAC signature + provider se `captured` fetch + amount match |
| Forged webhook | Raw-body HMAC, timing-safe compare, miss par 401 |
| Duplicate webhook (double PAID / double email) | `WebhookEvent.eventId` unique + status check |
| Webhook replay (purana captured event) | dedupe by event id; 24h window monitoring |
| Quantity manipulation to oversell | `UPDATE ... WHERE stock >= qty` atomic; 0 rows = OUT_OF_STOCK |
| Refund abuse | amount cap + DB CHECK + audit (admin RBAC Phase 1) |
| Screenshot/QR sharing | single-use QR + 5 min TTL + per-attempt QR id |
| Provider outage | 503 `PROVIDER_UNREACHABLE`, payment attempt FAILED, buyer retry |

## Kya baaki hai (before live money)

- [ ] Admin routes par RBAC + audit log (har refund/void log ho)
- [ ] Rate limiting + bot protection checkout par
- [ ] Razorpay webhook IP allow-list (optional, signature ke upar extra layer)
- [ ] Sentry/OTel me payment events (paid, failed, mismatch alerts)
- [ ] Daily reconciliation job (`reconcile-payments.scheduler.ts`): provider statement vs DB
- [ ] PCI note: card data hamare paas aata hi nahi — Razorpay hosted checkout/UPI QR use karte hain
