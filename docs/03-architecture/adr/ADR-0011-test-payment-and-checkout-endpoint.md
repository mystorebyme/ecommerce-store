# ADR-0011 — ₹1 test product + single-call checkout

**Date:** 2026-10-28
**Status:** Accepted

## Context

1. Live gateway ko real paise se verify karna tha, par ₹1,899 jaisa order test karna mehnga hai.
2. Buyer ke "Pay" button par browser do call karta tha — `POST /orders` → `POST /payments` —
   matlab do network round-trip aur do cold-start chances (serverless par mehnga).
3. Bank-SMS observer install hone tak payment confirm karne ka koi UI nahi tha (sirf curl).

## Decision

1. **Catalog bootstrap**: app boot par ek baar `prod_test1` (SKU `TEST-001`, `pricePaise: 100`)
   upsert hota hai — **create-only**. Maujood ho to price/stock chhua nahi jaata.
   `CATALOG_BOOTSTRAP=off` se band.
2. **`POST /api/v1/checkout`**: ek hi request me order + payment session + UPI QR.
   Server par sequence: orders service → payments service. Replay par wahi order/session.
   QR fail ho to order 201 ke saath `payment: null` + `meta.paymentError` (buyer retry kar sakta hai).
3. **`/admin` board** (temporary, storefront ke andar): live sessions + "Mark paid (UTR)".
   Har manual confirm bhi ek `Observation` (source `MANUAL`) banta hai — audit trail rehta hai.

## Consequences

* ₹1 ka asli payment se poora flow (order → QR → confirm → `PAID`) verify ho sakta hai.
* Ek network round-trip kam; checkout ka p50 latency ~150–300ms behtar.
* Bootstrap **kabhi** merchant ka data overwrite nahi karta — sirf missing product banata hai.
* Board temporary hai; jab `apps/admin` (alag subdomain, auth + RBAC) bane to yahan se hata denge.
