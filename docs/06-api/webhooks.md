# Webhooks — inbound (observer) + outbound (merchant)

> Purpose: dono directions ka contract, signature, dedupe aur retries
> Code: `apps/api/src/webhooks/observer.webhook.ts` · `apps/api/src/modules/payments/merchant-webhook.service.ts`

Is gateway me **do** tarah ke webhook hain:

```
bank SMS/email ──▶ [ observer ] ──HMAC──▶ /api/v1/observers/observations   (inbound)
                                              │
                                     match + verify
                                              ▼
merchant server ◀──HMAC── /api/youpi/webhook  (outbound: payment.success)
```

---

## A. Inbound: observer → gateway

**Endpoint:** `POST /api/v1/observers/observations`
**Header:** `x-observer-signature: sha256=<hex>` = `HMAC_SHA256(rawBody, OBSERVER_SHARED_SECRET)`

```json
{
  "source": "ANDROID_SMS",
  "deviceId": "merchant-phone-1",
  "messageId": "sms-991",
  "rawText": "Rs.3,798.00 credited to a/c XX4412. UPI ref 412345678901.",
  "observedAt": "2026-10-28T09:01:12.000Z"
}
```

Rules:
1. Signature galat / missing → `401 OBSERVER_SIGNATURE_INVALID`, kuch process nahi hota.
2. `messageId` observer-side unique hona chahiye (`deviceId + messageId` unique constraint).
3. `rawText` server par parse hota hai: amount (integer paise) + 12-digit UTR + sender VPA.
   Parse na ho → `422 UNPARSEABLE_MESSAGE` (guess nahi karte).
4. Debit message → `422 NOT_A_CREDIT`.
5. Response hamesha `200` + verdict (`SUCCESS | PROCESSING | DUPLICATE | UNMATCHED | SUSPICIOUS`) —
   observer ko retry loop me mat daalo.

Local test:

```bash
BODY='{"source":"ANDROID_SMS","deviceId":"dev-1","messageId":"m-1","rawText":"Rs.1,899.00 credited to a/c XX4412. UPI ref 412345678901."}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$OBSERVER_SHARED_SECRET" -hex | sed 's/^.* //')"
curl -sX POST localhost:4000/api/v1/observers/observations \
  -H 'content-type: application/json' -H "x-observer-signature: $SIG" --data-raw "$BODY"
```

Ya `npx tsx scripts/observer-simulator.ts pay <sessionId>`.

---

## B. Outbound: gateway → merchant server

Sirf ek event abhi: **`payment.success`** (settle hone par).

**Headers jo merchant ko milte hain:**

| Header | Value |
|--------|-------|
| `x-youpi-event` | `payment.success` |
| `x-youpi-delivery-id` | `dlv_xxxxxxxxxxxx` (unique, dedupe ke liye) |
| `x-youpi-timestamp` | Unix seconds |
| `x-youpi-signature` | `sha256=<hmac(rawBody, MERCHANT_WEBHOOK_SECRET)>` |

**Body:**

```json
{
  "event": "payment.success",
  "paymentId": "ses_0003",
  "orderId": "order_0002",
  "orderNumber": "YP-MVRFIYPZ",
  "amountPaise": 379800,
  "currency": "INR",
  "method": "upi",
  "utr": "412345678901",
  "reference": "YPVVS00JCV5",
  "vpa": "demostore@okhdfcbank",
  "senderVpa": "aarav@oksbi",
  "completedAt": "2026-10-28T09:00:00.000Z",
  "metadata": { "source": "youpi-selfhosted-gateway", "items": 1 }
}
```

### Merchant side verify (Node example)

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

app.post("/api/youpi/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const raw = req.body as Buffer;                      // RAW body — JSON.parse se pehle
  const received = (req.header("x-youpi-signature") ?? "").replace("sha256=", "");
  const expected = createHmac("sha256", process.env.MERCHANT_WEBHOOK_SECRET!)
    .update(raw)
    .digest("hex");

  const ok =
    received.length === expected.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(received));

  if (!ok) return res.status(401).send("bad signature");

  const event = JSON.parse(raw.toString());
  // delivery dedupe (DB unique on delivery-id)
  // amount check: order.amountPaise === event.amountPaise
  // tabhi order ko PAID karo
  res.sendStatus(200);
});
```

### Retries

| Attempt | Kab |
|---------|-----|
| 1 | Turant (settle ke saath) |
| 2 | 30 s baad |
| 3 | 2 min baad |
| 4 | 10 min baad |
| 5 | 30 min baad, phir `FAILED` (manual replay) |

2xx = delivered. Non-2xx / timeout (8 s) = retry. `OutboundWebhook` table me har attempt ka
status code aur error save hota hai (audit).

---

## Kab kaun sa webhook chalta hai

| Trigger | Inbound observer | Outbound merchant |
|---------|------------------|-------------------|
| Buyer QR scan karke pay karta hai, SMS aata hai | ✅ (settle) | ✅ `payment.success` |
| Credit aaya par koi session match nahi | ✅ (UNMATCHED) | ❌ (koi order nahi) |
| Same amount ke 2 sessions, note se pehchan nahi | ✅ (SUSPICIOUS) | ❌ (manual review) |
| Pay window expire (5 min) | ❌ | ❌ (buyer ko UI me pata chalta hai) |

## Hardening (production)

- [ ] Outbound `FAILED` par alert (Slack/email) — warna paisa aaya aur merchant ko pata nahi
- [ ] Observer keys per-device (shared secret rotate karo, purana `deviceId` block karo)
- [ ] Outbound ko BullMQ worker me shift karo jab email/invoice side-effects aayein
- [ ] Replay window: `x-youpi-timestamp` 5 min se purana ho to reject (optional, merchant side)
