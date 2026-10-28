# Payment links + admin UPI settings — API

Base: `https://youpi-gateway-api.vercel.app/api/v1`
Admin routes: header `x-admin-token: <ADMIN_API_TOKEN>`.

## Admin — UPI settings

| Method | Path | Kya karta hai |
|---|---|---|
| GET | `/admin/settings` | Live VPA, pending VPA, open-link limits |
| POST | `/admin/settings/vpa` | Naya VPA **stage** (PENDING) — live VPA nahi badalta |
| POST | `/admin/settings/vpa/test` | Pending VPA par **₹1 QR** |
| POST | `/admin/settings/vpa/confirm` | Manual activate (₹1 proof ke baad) |
| POST | `/admin/settings/vpa/cancel` | Pending hatao |
| POST | `/admin/settings/limits` | `{ minAmountPaise, maxAmountPaise }` |
| GET | `/admin/settings/audit?limit=50&action=` | Append-only audit log |

`POST /admin/settings/vpa` body:

```json
{ "vpa": "yourshop@okhdfcbank", "payeeName": "YouPI Store", "merchantCode": "5651" }
```

VPA regex: `^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$`

## Admin — payment links

| Method | Path | Kya karta hai |
|---|---|---|
| GET | `/admin/links` | Recent links (`usedCount/maxUses` ke saath) |
| POST | `/admin/links` | `{ kind: "FIXED"\|"OPEN", title, amountPaise?, maxUses?, expiresInHours? }` |
| POST | `/admin/links/:id/disable` | Link band karo (payment 409) |

## Public — buyer side

| Method | Path | Notes |
|---|---|---|
| GET | `/pay/limits` | Open-link min/max + payee (CDN cached 60s) |
| GET | `/pay/links/:token` | Link ki sach: amount, status, limits, remainingUses |
| POST | `/pay/links/:token` | `{ customerName, customerPhone, amountPaise? }` → order + UPI QR |
| POST | `/pay/open` | `{ amountPaise, customerName, customerPhone }` → order + UPI QR |

**Fixed link par** `amountPaise` bhejne ka koi fayda nahi — server DB ka amount use karta hai.
**Open link par** amount `min..max` ke bahar ho to `400 AMOUNT_OUT_OF_RANGE`.

Errors: `LINK_NOT_FOUND` (404), `LINK_NOT_PAYABLE` (409), `LINK_EXHAUSTED` (409),
`AMOUNT_OUT_OF_RANGE` (400), `RATE_LIMITED` (429).

## Links (storefront pages)

| Page | Kya |
|---|---|
| `/pay/<token>` | Fixed/open link checkout (QR + countdown ring) |
| `/pay/open` | Bina link ke "kuch bhi pay karo" |
| `/admin/settings` | VPA + ₹1 verification + limits + audit |
| `/admin/links` | Link banao / copy / disable |
| `/p/<slug>` | Product short link (UTM pass-through) |
