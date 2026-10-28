# ADR-0012 — Admin se UPI settings, ₹1 verification gate, aur payment links

**Date:** 2026-10-28
**Status:** Accepted

## Context

1. Merchant ko apna UPI VPA badalne ke liye redeploy karna padta tha (VPA env me tha).
   Par galat VPA par QR ban jaana = customer ka paisa galat jagah — isliye seedha "save" khatarnak hai.
2. Ads / WhatsApp / DM se paisa maangne ke liye har baar product + checkout banana padta tha.
3. Audit chahiye: kisne kab VPA badla, kaun sa link bana, kab band hua.

## Decision

1. **Settings DB me** (`Setting` KV + `MerchantAccount.vpa`):
   - Naya VPA `POST /admin/settings/vpa` se **PENDING** hota hai. Purana VPA live rehta hai.
   - `POST /admin/settings/vpa/test` us pending VPA par **₹1 ka QR** banata hai
     (gateway me `vpaOverride` — sirf isi path par allowed).
   - ₹1 settle (observer ya manual confirm) hone par `promoteIfPendingMatches` naya VPA live karta hai.
   - Har step `AuditLog` me append hota hai; DB trigger `UPDATE`/`DELETE` block karta hai.
2. **Payment links** (`PaymentLink`):
   - Public URL me sirf **token** (`/pay/<token>`) — amount/limits DB se.
   - `FIXED`: amount DB me lock; request ka `amountPaise` ignore.
   - `OPEN`: buyer amount daalta hai, `settings.min_open_amount_paise` / `max_...` ke andar.
   - `maxUses` atomic increment (ek UPDATE me `usedCount < maxUses` check) — race-safe.
   - Expiry, disable, aur `USED_UP`/`EXPIRED` states public view me saaf dikhte hain.
3. **UPI intent** me `tr` (order id) aur optional `mc` add — reconciliation aur merchant identity ke liye.
4. **Rate limit** `/api/v1/pay/*` par (20 req/min/IP per instance). Serverless par best-effort;
   DB constraints + platform limits asli guard hain.
5. **Visuals**: count-up (easeOutExpo), donut price breakdown (GST math), countdown progress ring,
   QR scale-in, spring hover — sab `prefers-reduced-motion` respect karte hain.

## Consequences

* VPA badalne ke liye redeploy nahi — par galti se galat VPA live ho hi nahi sakta (₹1 proof chahiye).
* Link se payment order `linkId` ke saath aata hai → attribution aur reconciliation aasaan.
* ₹1 test ke liye ek chhota extra step hai (admin ko 2 click) — ye deliberate friction hai.
* Open link par buyer amount chunta hai, par amount **server** decide karta hai jo QR me jaata hai.
