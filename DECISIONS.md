# DECISIONS.md

Format: Date | Decision | Reason | Alternatives

| Date | Decision | Reason | Alternatives |
|------|----------|--------|--------------|
| 2026-10-27 | Naya app `apps/youpi-demo` add kiya (demo suite), own `package.json` + `npm`, Next.js static export (`output: "export"`) | Client ko turant live demo chahiye tha; static export Vercel free tier par bina DB/Redis/server chalta hai, aur baaki monorepo abhi placeholder hai isliye pnpm/turbo wiring block na ho | Demo ko `apps/web` me daalna (storefront ka scope mix ho jata), ya sirf Figma mockups (clickable nahi) |
| 2026-10-27 | Demo ka apna design system (ink/paper/brand-green + Sora/DM Sans), reference project ka UI copy nahi | AGENTS.md rule: reference site ka logo/naam/photos/copy use nahi karna; demos ke liye apni branding | Reference UI clone karna (rule violate) |
| 2026-10-27 | Demo state machine browser me (React context + localStorage), real backend nahi | Demo ko deterministic aur offline-presentable rakhna; backend Phase 1 me aayega | Demo ke liye chhota Express server (deploy + CORS overhead) |
| 2026-10-27 | Webhook signature demo me asli SHA-256/HMAC (dependency-free implementation) | Client ke saamne signature verify/tamper live dikhana; copy-paste snippets se match karta hai | Fake hex string (verify demo possible nahi hota) |
| 2026-10-27 | Money har jagah integer paise; rupees sirf format helpers me | `STRUCTURE.md` critical rule #1 aur ADR-0009 | Float rupees (rounding bugs) |
