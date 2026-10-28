# Payment API — contract (self-hosted UPI gateway)

> Purpose: checkout ke saare endpoints — order, session/QR, status, cancel, observer ingest, admin
> Base URL: `http://localhost:4000/api/v1` (prod: `https://api.<domain>/api/v1`)

## 0. Ek nazar me

| Method | Path | Kya |
|--------|------|-----|
| `POST` | `/orders` | Order banao (price server se, stock atomic, `Idempotency-Key`) |
| `POST` | `/payments` | Session + **single-use UPI QR** (ya queue position) |
| `GET` | `/payments/:id` | Status + timers + position (2–3 s poll) |
| `POST` | `/payments/:id/cancel` | Buyer ne chhoda → slot agle ko |
| `GET` | `/payments/order/:orderId/attempts` | Us order ke saare tries |
| `POST` | `/observers/observations` | **Observer only** — bank credit (HMAC signed) |
| `POST` | `/admin/merchant` | VPA/webhook config (`x-admin-token`) |
| `GET` | `/admin/sessions` | **Live board** — kaun pay kar raha hai + countdown |
| `POST` | `/admin/sessions/:id/confirm` | **Manual confirm** (bank app me paisa dikha, SMS nahi aaya) |
| `GET` | `/admin/deliveries` | Merchant webhook deliveries (PENDING/DELIVERED/FAILED) |
| `POST` | `/admin/deliveries/:id/replay` | Webhook delivery dobara bhejo |
| `GET` | `/health` | Gateway + merchant config ki jhalak |

---

## 1. `POST /orders`

**Headers:** `content-type: application/json`, `idempotency-key: <8-128 chars>`

```json
{
  "customerName": "Aarav Sharma",
  "customerPhone": "9876543210",
  "items": [{ "productId": "clx123", "qty": 2 }]
}
```

`201 Created` (naya) / `200 OK` (`meta.replayed: true`):

```json
{
  "data": {
    "id": "clx_order_1",
    "number": "YP-MVR703HW",
    "status": "PENDING_PAYMENT",
    "amountPaise": 379800,
    "currency": "INR",
    "customer": { "name": "Aarav Sharma", "phone": "9876543210" },
    "items": [
      { "sku": "KURTA-01", "name": "Handblock Cotton Kurta", "unitPricePaise": 189900, "qty": 2, "lineTotalPaise": 379800 }
    ],
    "createdAt": "2026-10-28T09:00:00.000Z"
  },
  "meta": { "replayed": false }
}
```

Client price **nahi** bhejta — bhejta bhi to ignore. Errors: `400 IDEMPOTENCY_KEY_REQUIRED`,
`404 PRODUCT_NOT_FOUND`, `409 PRODUCT_INACTIVE`, `409 OUT_OF_STOCK`, `422 VALIDATION_FAILED`.

---

## 2. `POST /payments` — session + QR

```json
{ "orderId": "clx_order_1" }
```

`201 Created`:

```json
{
  "data": {
    "sessionId": "ses_0003",
    "orderId": "clx_order_1",
    "orderNumber": "YP-MVR703HW",
    "status": "ACTIVE",
    "amountPaise": 379800,
    "currency": "INR",
    "reference": "YPVVS00JCV5",
    "vpa": "demostore@okhdfcbank",
    "utr": null,
    "queuePosition": 1,
    "aheadInQueue": 0,
    "payExpiresAt": "2026-10-28T09:05:00.000Z",
    "verifyExpiresAt": null,
    "secondsLeftToPay": 300,
    "secondsLeftToVerify": null,
    "upi": {
      "string": "upi://pay?pa=demostore@okhdfcbank&pn=Demo%20Store&am=3798.00&cu=INR&tn=YPVVS00JCV5",
      "svg": "<svg …>",
      "dataUrl": "data:image/svg+xml;base64,PHN2Zy…"
    },
    "live": true
  }
}
```

UI rules:
- `status: "ACTIVE"` → QR dikhao (`upi.dataUrl` seedha `<img src>` me), 5:00 ka countdown.
- `status: "QUEUED"` → QR **nahi** dikhao; "aap position N par hain" + slot khaali hote hi poll se
  status `ACTIVE` ho jayega (`svg`/`dataUrl` null hote hain).
- `upi.string` se apna QR bana sakte ho (koi third-party QR service nahi chahiye).

Errors: `404 ORDER_NOT_FOUND`, `409 ORDER_NOT_PAYABLE`, `503 MERCHANT_NOT_CONFIGURED`
(VPA set nahi — `POST /admin/merchant`).

---

## 3. `GET /payments/:id` — status (poll 2–3 s)

```json
{
  "data": {
    "sessionId": "ses_0003",
    "status": "SUCCESS",
    "utr": "412345678901",
    "amountPaise": 379800,
    "secondsLeftToPay": 0,
    "live": false
  }
}
```

Polling band karo jab `SUCCESS | FAILED | EXPIRED | CANCELLED | SUSPICIOUS`.

Kya kya dekhna hai:

| `status` | Buyer ko dikhao |
|----------|-----------------|
| `QUEUED` | "Aapki baari aa rahi hai — position N" |
| `ACTIVE` | QR + countdown |
| `PROCESSING` | "Payment check ho raha hai…" (30 s tak) |
| `SUCCESS` | Order confirmed + `utr` |
| `EXPIRED` | "QR expire ho gaya" + retry button (naya session) |
| `SUSPICIOUS` | "Support se baat karein" (paise kat gaye ho to refund) |

---

## 4. `POST /payments/:id/cancel`

```json
{ "reason": "buyer changed mind" }
```

`200` → `status: "CANCELLED"`, slot turant agle QUEUED buyer ko chala jaata hai.

---

## 5. `POST /observers/observations` — sirf observer (HMAC)

**Headers:** `x-observer-signature: sha256=<hmac(rawBody, OBSERVER_SHARED_SECRET)>`

```json
{
  "source": "ANDROID_SMS",
  "deviceId": "merchant-phone-1",
  "messageId": "sms-991",
  "rawText": "Rs.3,798.00 credited to a/c XX4412. UPI ref 412345678901."
}
```

Ya structured (parsing skip): `{ "amountPaise": 379800, "utr": "412345678901", "senderVpa": "aarav@oksbi" }`

`200` hamesha (verdict body me):

```json
{
  "data": {
    "verdict": "SUCCESS",
    "message": "Payment confirmed — order … PAID, UTR 412345678901.",
    "observationId": "obs_0007",
    "sessionId": "ses_0003",
    "status": "SUCCESS"
  }
}
```

| verdict | Matlab |
|---------|--------|
| `SUCCESS` | Payment confirm, order PAID |
| `PROCESSING` | Match hua, 2nd source ka wait (30 s) |
| `DUPLICATE` | Same UTR/message pehle aa chuka |
| `UNMATCHED` | Credit aaya, koi live session nahi → refund/manual |
| `SUSPICIOUS` | Same amount ke kai sessions, pehchan nahi hui → manual |

Errors: `401 OBSERVER_SIGNATURE_INVALID`, `422 UNPARSEABLE_MESSAGE`, `422 NOT_A_CREDIT`,
`503 OBSERVER_SECRET_MISSING`.

---

## 6. `POST /admin/merchant` (`x-admin-token`)

```json
{
  "name": "Demo Store",
  "vpa": "demostore@okhdfcbank",
  "payeeName": "Demo Store",
  "webhookUrl": "https://merchant.example.com/api/youpi/webhook",
  "webhookSecret": "whsec_16_chars_min",
  "payWindowSeconds": 300,
  "verifyWindowSeconds": 30
}
```

Response me secret kabhi wapas nahi aata — sirf `webhookSecretSet: true/false`.
`GET /admin/merchant` current config deta hai. Token galat → `401 ADMIN_UNAUTHORIZED`.

---

## 7. Admin ops (`x-admin-token`)

### 7.1 `GET /admin/sessions?status=ACTIVE,QUEUED,PROCESSING&limit=50`

Live board — timers pehle evaluate hote hain, phir list:

```json
{
  "data": [
    {
      "sessionId": "ses_0003",
      "orderId": "order_0002",
      "amountPaise": 189900,
      "reference": "YPVVS00JCV5",
      "status": "ACTIVE",
      "utr": null,
      "payExpiresAt": "2026-10-28T09:05:00.000Z",
      "secondsLeftToPay": 300,
      "secondsLeftToVerify": null,
      "createdAt": "2026-10-28T09:00:00.000Z"
    }
  ],
  "meta": { "count": 1, "statuses": ["ACTIVE", "QUEUED", "PROCESSING"] }
}
```

### 7.2 `POST /admin/sessions/:id/confirm` — manual proof

Jab bank app me credit dikh raha ho par observer (SMS/email) na aaya ho:

```json
{ "utr": "412345678901", "amountPaise": 189900, "senderVpa": "aarav@oksbi", "note": "Paytm app me dikha" }
```

- `utr` **zaroori** (9–18 digits) — yahi reconciliation ka proof hai.
- `amountPaise` optional; diya aur session se match nahi hua → `409 ORDER_AMOUNT_MISMATCH`.
- Session `QUEUED | ACTIVE | PROCESSING` ho tabhi confirm hota hai (otherwise `409`).
- Ye ek `BankObservation` (source `MANUAL`, status `MATCHED`) bhi banata hai, isliye ledger 1:1 rehta hai.
- Already `SUCCESS` → `meta.alreadyConfirmed: true` (idempotent).

### 7.3 `GET /admin/deliveries?status=PENDING|DELIVERED|FAILED` aur `POST /admin/deliveries/:deliveryId/replay`

Merchant webhook ki har delivery ka status, attempts, last status code. `replay` us delivery ko
turant dobara bhejta hai (signature wahi HMAC, delivery-id wahi — merchant dedupe kar sakta hai).

---

## 8. `GET /health`

```json
{
  "status": "ok",
  "gateway": "youpi-selfhosted",
  "merchantVpa": "demostore@okhdfcbank",
  "payWindowSeconds": 300,
  "verifyWindowSeconds": 30,
  "observersEnabled": true,
  "webhookDelivery": true,
  "time": "2026-10-28T09:00:00.000Z"
}
```

## Error shape (uniform)

```json
{
  "error": {
    "code": "OUT_OF_STOCK",
    "message": "Kurta ka stock khatam ho gaya. Qty kam karke try karo.",
    "details": [],
    "requestId": "0f0b0f5e-…"
  }
}
```

`requestId` `x-request-id` header me bhi — logs me isi se trace karo.
