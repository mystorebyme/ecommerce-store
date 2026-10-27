# Payment status API — contract

> Purpose: `GET payment status` endpoint ka contract (web client isi se QR ke saath status dikhata hai)
> Base URL: `http://localhost:4000/api/v1` (prod: `https://api.<domain>/api/v1`)

## 1. `POST /orders` — order banao (server price)

**Headers:** `content-type: application/json`, `idempotency-key: <8-128 chars>`

```json
{
  "customerName": "Aarav Sharma",
  "customerPhone": "9876543210",
  "items": [{ "productId": "clx123", "qty": 2 }]
}
```

`201 Created` (naya) / `200 OK` (`meta.replayed: true` — same key dobara):

```json
{
  "data": {
    "id": "clx_order_1",
    "number": "YP-MVR703HW",
    "status": "PENDING_PAYMENT",
    "amountPaise": 509700,
    "currency": "INR",
    "customer": { "name": "Aarav Sharma", "phone": "9876543210" },
    "items": [
      { "sku": "KURTA-01", "name": "Handblock Cotton Kurta", "unitPricePaise": 189900, "qty": 2, "lineTotalPaise": 379800 },
      { "sku": "TOTE-01", "name": "Canvas Tote — Indigo", "unitPricePaise": 129900, "qty": 1, "lineTotalPaise": 129900 }
    ],
    "createdAt": "2026-10-28T09:00:00.000Z"
  },
  "meta": { "replayed": false }
}
```

**Client price nahi bhejta** — bhejta bhi to ignore hota hai. Amount DB ke `Product.pricePaise` se banta hai.

Errors: `400 IDEMPOTENCY_KEY_REQUIRED`, `404 PRODUCT_NOT_FOUND`, `409 PRODUCT_INACTIVE`,
`409 OUT_OF_STOCK`, `422 VALIDATION_FAILED`.

## 2. `POST /payments/intents` — single-use UPI QR banao

**Headers:** `idempotency-key` zaroori.

```json
{ "orderId": "clx_order_1" }
```

`201 Created`:

```json
{
  "data": {
    "paymentId": "clx_pay_1",
    "orderId": "clx_order_1",
    "orderNumber": "YP-MVR703HW",
    "amountPaise": 509700,
    "currency": "INR",
    "status": "PENDING",
    "expiresAt": "2026-10-28T09:05:00.000Z",
    "provider": { "name": "razorpay", "keyId": "rzp_test_xxxxxxxx" },
    "qr": { "id": "qr_xxxx", "imageUrl": "https://rzp.io/i/xxxx", "qrString": null },
    "checkout": {
      "key": "rzp_test_xxxxxxxx",
      "orderId": "order_xxxx",
      "amountPaise": 509700,
      "currency": "INR",
      "name": "Demo Store",
      "description": "Order YP-MVR703HW",
      "prefill": { "name": "Aarav Sharma", "contact": "+919876543210" },
      "notes": { "paymentId": "clx_pay_1", "orderId": "clx_order_1" }
    }
  }
}
```

- `qr.imageUrl` → `<img>` me dikhao. `qr.qrString` ho to QR library se bhi render kar sakte ho.
- `checkout` → Razorpay Checkout.js (`razorpay.open({...})`) ke liye ready object (card/netbanking/UPI app).
- `expiresAt` → client countdown isi se (server time bhi `Date` header me aata hai).

Errors: `404 ORDER_NOT_FOUND`, `409 ORDER_NOT_PAYABLE` (already paid/cancelled),
`422 AMOUNT_OUT_OF_RANGE` (₹1 se ₹5,00,000), `503 PROVIDER_ERROR`.

## 3. `GET /payments/:id` — status (poll har 2–3s)

```json
{
  "data": {
    "paymentId": "clx_pay_1",
    "status": "PAID",
    "amountPaise": 509700,
    "expiresAt": "2026-10-28T09:05:00.000Z",
    "qr": { "id": "qr_xxxx", "imageUrl": "https://rzp.io/i/xxxx", "qrString": null }
  }
}
```

`status` values: `CREATED | PENDING | PAID | FAILED | EXPIRED | REFUNDED | PARTIALLY_REFUNDED`.

Polling stop karo jab `PAID | FAILED | EXPIRED | REFUNDED` ho. Server har call par
provider se bhi verify karta hai, isliye webhook der se aaye to bhi status sahi milega.

## 4. `POST /payments/:id/verify` — Razorpay Checkout (card/UPI app) ke baad

```json
{
  "razorpay_order_id": "order_xxxx",
  "razorpay_payment_id": "pay_xxxx",
  "razorpay_signature": "<checkout response se>"
}
```

Server `HMAC_SHA256(order_id|payment_id, key_secret)` verify karta hai, phir provider se
payment fetch karke `captured` check karta hai. Sirf tab `PAID`.

Errors: `400 ORDER_MISMATCH`, `401 SIGNATURE_INVALID`, `409 PAYMENT_NOT_CAPTURED`.

## 5. `POST /payments/:id/refund` (admin)

```json
{ "amountPaise": 100000, "reason": "customer request" }
```

`amountPaise` optional — na do to bacha hua poora amount. `PAID`/`PARTIALLY_REFUNDED` par hi allowed.

Errors: `409 PAYMENT_NOT_REFUNDABLE`, `422 REFUND_EXCEEDS_PAID`.

## Error shape (uniform)

```json
{
  "error": {
    "code": "OUT_OF_STOCK",
    "message": "Kurta ka stock khatam ho gaya. Qty kam karke try karo.",
    "details": [],
    "requestId": "0f0b0f5e-..."
  }
}
```

`requestId` har response ke `x-request-id` header me bhi hota hai — support/log me isi se trace karo.
