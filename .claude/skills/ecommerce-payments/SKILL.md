---
name: ecommerce-payments
description: Use when writing or reviewing anything about payments, UPI QR codes, payment webhooks, refunds, payment status or checkout in this store.
---

# Ecommerce payments

## Hard rules
1. Money is an integer in paise everywhere (DB, API, code). Never float. Convert to rupees only for display.
2. The server computes the final amount from database prices when the order is created. Never accept an amount from the client.
3. Payments go only through the merchant's own payment gateway account via its official API. Never automate another website's login or QR flow, and never route customer money through a third-party account.

## One QR per payment attempt
- Every checkout attempt creates its own payment attempt row (order id, provider QR id, amount in paise, status, expires_at).
- Create a single-use, fixed-amount UPI QR per attempt through the gateway (Razorpay QR Codes: type `upi_qr`, usage `single_use`, `fixed_amount` true, `payment_amount` in paise, `close_by` for expiry). The UPI QR feature must be enabled by Razorpay support. Per the docs the QR expires within 2 hours at most, minimum 2 minutes.
- Never reuse one QR for several customers or several orders.
- A "new QR" button closes the old attempt and creates a NEW attempt.

## Matching and concurrency
- Match a payment to an order by the provider QR/attempt id, never by amount. Many customers paying the same amount at the same time is normal and must work.

## State machine
`created -> pending -> paid | failed | expired | refunded`. Only a verified webhook or a server-side provider lookup may set `paid`. A browser redirect or client message never marks an order paid.

## Webhooks
- Mount the webhook route with `express.raw()` BEFORE `express.json()`.
- Verify the HMAC signature on the raw body with the webhook secret (not the API key secret).
- Dedupe with the `x-razorpay-event-id` header stored in a table with a unique constraint.
- Return 2xx fast (the provider may resend if the server is slow); do the real work in a queue.
- The QR "closed" webhook fires only on manual close, not on auto-expiry. So run `expire-qr.scheduler.ts` and `reconcile-payments.scheduler.ts` to expire attempts and to catch missed webhooks by asking the provider API.
- Verify the exact name of the payment-received event in the gateway's webhook docs before coding it.

## Checkout UI
Poll `GET /api/v1/payments/:attemptId/status` every few seconds. Show clear messages for paid, failed and expired, each with the next action. Stop polling on a final state.

## Late or odd payments
Money received for an expired or unknown attempt goes to a manual-refund queue and is logged. Never silently drop it.

## Must have tests
Duplicate webhook, wrong signature, 40 parallel same-amount payments, expired QR, missed webhook recovered by reconcile job.
