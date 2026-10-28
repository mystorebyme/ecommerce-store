---
name: youpi-payments
description: Use when changing YouPI Store admin settings, UPI VPA, payment links, checkout UI or payment animations.
---
# Rules

- Price/amount hamesha **server se**, URL/request se nahi. Payment link me amount DB se aata hai.
- UPI VPA **settings (DB)** me, admin-only, `x-admin-token` se. Env me hardcode mat karo.
- VPA badalne par: **stage → ₹1 test → tabhi live**. Purana VPA tab tak live rehta hai.
- Har change **append-only `AuditLog`** me (kisne, kab, purana → naya). UPDATE/DELETE DB trigger se block.
- Fixed links: amount **locked**; buyer ka bheja amount ignore hota hai. Open links: `min/max` server-side validate.
- Payment confirm sirf **observer webhook / manual proof** se. Browser ke "paid" claim par kabhi nahi.
- Har QR me unique `tr` (order id), clear `tn` (reference), aur `mc` sirf tab jab merchant code ho.
- Animations: `prefers-reduced-motion` respect karo; number/animation display-only ho, calculation kabhi client par nahi.
- UPI apps ke anti-fraud/risk checks **bypass mat karo** (na hi unhe chhupane ki koshish). Trust merchant verification se banao:
  business VPA, consistent payee name, clear policy pages, refund flow, disputes ka record.
- Payment/checkout routes par rate limit + zod validation (shared `@youpi/validation`).
