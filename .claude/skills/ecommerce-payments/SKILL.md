---
name: ecommerce-payments
description: Use when writing or reviewing anything about payments, UPI QR codes, payment webhooks, refunds, payment status or checkout in this store.
---

# Ecommerce payments

## Hard rules
1. Money is an integer in paise everywhere (DB, API, code). Never float. Convert to rupees only for display.
2. The server computes the final amount from database prices when the order is created. Never accept an amount from the client.
3. Money goes only to the merchant's own UPI VPA (this project runs a self-hosted gateway, no aggregator). Never automate another website's login, never route customer money through a third-party account.

## One QR per payment attempt
- Every checkout attempt creates its own payment attempt row (order id, provider QR id, amount in paise, status, expires_at).
- Build the QR yourself: `upi://pay?pa=<merchant VPA>&pn=<payee>&am=<rupees>&cu=INR&tn=<reference>`, rendered as a vector SVG (`qrcode` npm package). Single-use by session, fixed amount, `payExpiresAt` = 5 min.
- Never reuse one QR for several customers or several orders.
- A "new QR" button closes the old attempt and creates a NEW attempt.

## Matching and concurrency
- Match a credit to a session by exact amount **plus** the session reference in the QR note (`tn`). Because one VPA has only ONE `ACTIVE` slot (FIFO queue for others), ambiguous same-amount matches are rare — and when they are ambiguous, mark `SUSPICIOUS` instead of guessing.
- A verified bank observation (UTR) is the only proof of payment. Two independent sources are required for untrusted channels (Gmail/Messages); a trusted Android SMS observer can confirm alone.

## State machine
`created -> pending -> paid | failed | expired | refunded`. Only a verified webhook or a server-side provider lookup may set `paid`. A browser redirect or client message never marks an order paid.

## Webhooks
- Mount the webhook route with `express.raw()` BEFORE `express.json()`.
- Verify `HMAC_SHA256(rawBody, OBSERVER_SHARED_SECRET)` against `x-observer-signature` (timing-safe compare).
- Dedupe with unique `(deviceId, messageId)` and unique `(utr, amountPaise)` constraints.
- Return 2xx fast (the provider may resend if the server is slow); do the real work in a queue.
- Timers live in the DB (`payExpiresAt`, `verifyExpiresAt`) and a 5s scheduler tick expires sessions; never rely on a browser countdown.
- Outbound merchant webhooks must be signed (`x-youpi-signature`), carry a stable delivery id, and retry with backoff.

## Checkout UI
Poll `GET /api/v1/payments/:attemptId/status` every few seconds. Show clear messages for paid, failed and expired, each with the next action. Stop polling on a final state.

## Late or odd payments
Money received for an expired or unknown attempt goes to a manual-refund queue and is logged. Never silently drop it.

## Must have tests
Duplicate UTR, wrong signature, same-amount sessions with/without reference in the note, expired pay window + queue promotion, cross-source verification, webhook retry backoff.
