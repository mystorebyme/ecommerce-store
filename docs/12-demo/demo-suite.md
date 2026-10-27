# YouPI-style payments demo — live, clickable, deployable

> Status: **ready to demo / deploy**
> App: `apps/youpi-demo` (Next.js 14, static export, Vercel-ready)
> Live demo: deploy karke URL yahan paste karo (neeche step 9 dekho)

Ye document client ko dikhane ke liye hai — kya bana hai, kaha kya dekhna hai, kaise chalana hai,
kaise Vercel par live karna hai, aur asli API se kaise jodna hai.

---

## 1. Ek line me

Ek hi app me poora payment journey chalta hai: **store → WhatsApp OTP → dynamic UPI QR →
single-slot queue → bank observer verification → signed webhook → admin ledger**, aur saath me
step-by-step integration docs. Sab kuch browser ke sandbox ledger par chalta hai, isliye demo ke
time internet/bank ki zarurat nahi.

---

## 2. Demo me kya-kya hai (client ko isi order me dikhao)

| # | Route | Kya dikhta hai | Client ko kya bolna hai |
|---|-------|----------------|--------------------------|
| 1 | `/` | Overview + live hero checkout (₹1 / ₹10 / ₹49 / ₹149) | "Yahan se turant ek payment chala sakte hain" |
| 2 | `/store` | Merchant storefront, cart drawer, coupon, pincode | "Store aapka, gateway sirf order id + amount dekhta hai" |
| 3 | `/checkout` | OTP gate → amount → QR → 5:00 timer → 0:30 verify | "Amount server decide karta hai, browser nahi" |
| 4 | `/outcomes` | 5 outcome pages (success/failed/suspicious/expired/cancelled) | "Unhappy path bhi designed hai" |
| 5 | `/admin` | Console: payments, queue, observers, accounts, branding, webhooks, security, settings | "Staff ka poora control, audit ke saath" |
| 6 | `/admin/webhooks` | Live HMAC verify + "tamper" toggle | "Signature fail hote hi 401 — proof yahi hai" |
| 7 | `/demo-pack` | One-click scenarios + 5-minute call script | "Call ke waqt kuch type nahi karna padega" |
| 8 | `/docs` | Full integration guide + Vercel deploy + go-live checklist | "Ye seedha engineering ko bhej sakte hain" |

**5-minute script:** `/store` pe kurta add karo → Pay → OTP verify → QR + timer dikhao →
`/demo-pack` se "Fill the queue" → `/checkout` pe "I have paid" → success →
`/admin/payments` me row → `/admin/webhooks` me signature verify → `/docs` pe checklist.

---

## 3. Local par chalana

```bash
cd apps/youpi-demo
npm install
npm run dev          # http://localhost:3000
```

Production build (static export):

```bash
npm run build        # out/ folder banta hai
npx serve out
```

Node 20+ chahiye (`.nvmrc` dekho).

---

## 4. Vercel par live karna (step by step)

### Option A — CLI (fastest)

```bash
cd apps/youpi-demo
npm install
npx vercel login          # browser me login
npx vercel --prod         # pehli baar 4-5 sawal poochhega
```

Sawaalon ke jawab:

| Sawal | Jawab |
|-------|-------|
| Set up and deploy? | `Y` |
| Which scope? | apna personal account |
| Link to existing project? | `N` |
| Project name | `youpi-payments-demo` |
| In which directory is your code located? | `./` |
| Want to modify these settings? | `N` (auto-detect Next.js) |

Uske baad URL milega: `https://youpi-payments-demo.vercel.app`.

### Option B — GitHub se (auto-deploy on push)

1. GitHub par repo push karo (ye branch).
2. [vercel.com/new](https://vercel.com/new) → repo import karo.
3. **Root Directory** = `apps/youpi-demo` (important — repo monorepo hai).
4. Framework: **Next.js** (auto).
5. Build command `npm run build`, Output directory `out`, Install `npm install`.
6. Environment variables: **koi zaruri nahi** (pure demo). Optional: `NEXT_PUBLIC_SITE_URL`
   sitemap/robots ke liye.
7. **Deploy** → har push par naya deployment.

### Vercel par dhyan rakhne wali baat

- Ye app **fully static** hai (`output: "export"`), isliye free tier par bina server/database chalti hai.
- Asli API (observers, BullMQ queue, DB) Vercel serverless par theek nahi baithega — usko Railway/Fly/EC2
  jaise always-on host par rakho aur webhook wahan bhejo. Detail `docs/12-demo/demo-suite.md` me hai.
- Custom domain: Vercel → Settings → Domains → `pay.yourbrand.com` add karo aur DNS me CNAME lagao.

---

## 5. Sandbox vs production (client ko clear bata do)

| Cheez | Is demo me | Production me |
|-------|------------|----------------|
| State machine | Browser (localStorage) | Server + Postgres |
| QR | `qrcode` se browser me bana, sandbox VPA | Server-generated single-use QR, merchant ka VPA |
| Timers | Client tick, lekin absolute timestamps par | DB timestamps, restart-proof |
| Observers | Simulated (Android/Gmail/SMS feed) | Asli Android APK + Gmail + Messages |
| Webhook | Demo delivery log + asli HMAC | Asli HTTP delivery, retries, replay protection |
| Money | Kabhi move nahi hota | Merchant ke bank account me seedha |

---

## 6. Asli API se jodna (engineering ke liye)

1. `src/lib/store.tsx` ke methods ko HTTP calls se replace karo:
   `createSession → POST /api/v1/payments`, `checkPayment → GET /api/v1/payments/:id`,
   `cancelSession → POST /api/v1/payments/:id/cancel`.
2. QR server se lo (`qr_svg_url`), browser me generate mat karo.
3. Timers API ke `pay_expires_at` / `verify_expires_at` se chalao.
4. Observer + webhook panels ko real endpoints se feed karo.
5. Order **sirf** verified webhook par paid mark karo — browser callback par kabhi nahi.

Poora contract: `/docs` route (API, SDK, webhook verify in Node/Python/PHP, error codes) aur
`docs/06-api/` folder.

---

## 7. Design system (agar client branding badalni ho)

- Tokens: `apps/youpi-demo/tailwind.config.ts` — `ink`, `paper`, `line`, `brand`, `accent`, `ok/bad/warn/info`.
- White-label live demo: `/admin/branding` — naam, tagline, colour, logo mark, support email/phone,
  guarantee line. Colour change karke `/checkout` kholo, header turant badal jayega.
- Fonts: Sora (display) + DM Sans (body), self-hosted `public/fonts`.

---

## 8. Quality checklist (jo already pass hai)

- [x] `next build` clean (TypeScript strict, 18 static routes)
- [x] Mobile + desktop layouts (tables scroll, drawers full-width)
- [x] Empty, loading aur error states har table/list me
- [x] Keyboard: skip link, focus rings, Escape se drawer band
- [x] `prefers-reduced-motion` respect
- [x] Amounts integer paise, server-style recompute
- [x] Webhook HMAC asli SHA-256 (dependency-free) — tamper test live
- [x] Reset demo data (footer + admin settings)
- [x] SEO: metadata, robots, sitemap

---

## 9. Deploy hone ke baad

1. Vercel URL ko `README.md` (root) aur is file me note karo.
2. Client ko 3 link bhejo: `/demo-pack`, `/admin`, `/docs`.
3. Demo se pehle footer → **Reset demo data** dabao taaki ledger clean ho.
