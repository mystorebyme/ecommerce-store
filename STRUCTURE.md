# STRUCTURE.md - Final Folder Structure (v4)

Har line me `#` ke baad likha hai ki wo folder/file kya hai. `[Step N]` batata hai ki wo kis step me banegi. `[P1]`/`[P2]` batata hai ki backend module launch se pehle (Phase 1) banega ya launch ke baad (Phase 2).

## Tech stack (assumed; `docs/03-architecture/adr` me confirm hoga)
- Storefront aur Admin: Next.js + TypeScript + Tailwind
- Backend: Node.js + Express + TypeScript, API versioned `/api/v1`
- Database: PostgreSQL + Prisma, Redis (cache, rate limit, BullMQ queues)
- Monorepo: pnpm workspaces + Turborepo
- Files: S3 ya Cloudflare R2 (presigned upload)
- Payment: Razorpay, Shipping: Shiprocket
- Stack badla (MERN, Laravel) to sirf `apps/` ke andar ka code structure badlega. `docs/`, `database/`, `infra/`, `tests/` same rahenge.

## Build phases
Folders sab abhi bane hue hain (khali placeholders). Code is order me likhna hai:

- **Phase 1 (launch se pehle, ek paid order lene ke liye zaroori):** auth, users, addresses, categories, products, inventory, uploads, cart, orders, payments, shipping, notifications, invoices, consents, audit-logs, settings
- **Phase 2 (launch ke baad):** wishlist, coupons, reviews, banners, search, cms, analytics

Phase 1 me 16 modules isliye hain ki order lene ke liye products ke saath categories, inventory, addresses, shipping, invoice (GST) bhi chahiye, aur consents/audit-logs legal aur security ke liye. Inme se kuch (jaise consents, settings) chhote hain.

## Critical engineering rules (agent ko har haal me follow karne hain)
1. **Paisa integer paise me.** Kabhi float nahi. Screen par dikhate waqt hi rupees me convert.
2. **Server price decide karta hai.** Client se aayi price par bharosa nahi; cart/order me price server recompute kare.
3. **Stock atomic.** `UPDATE ... SET stock = stock - qty WHERE id = ? AND stock >= qty`, affected rows 0 to "Out of stock". DB me `CHECK (stock >= 0)` bhi (`database/sql/constraints.sql`). Checkout par stock reserve ho aur unpaid hone par expire ho (`release-expired-stock.scheduler.ts`).
4. **Razorpay webhook:** `app.ts` me `express.json()` se PEHLE `express.raw()` se mount. Signature raw body par, webhook secret se (merchant key secret se nahi). `x-razorpay-event-id` ko unique constraint ke saath Postgres me save karke duplicate roko. Turant 2xx do, asli kaam queue me.
5. **Payment confirm sirf server se** (verified webhook ya server-side verify). Browser redirect par order paid mark nahi hoga.
6. **Order create idempotent:** `Idempotency-Key` header, taaki double-click par double order na bane.
7. **File upload presigned URL se.** Image Express se nahi guzarti; client seedha storage par, API ko sirf URL.
8. **Queues BullMQ + Redis.** Email/SMS/WhatsApp request ke andar nahi; workers `worker.ts` me alag process.
9. **Validation ek jagah:** shared zod schemas `packages/validation` me. Module ki `.schema.ts` me sirf API-only extras.
10. **Auth:** access token chhota, refresh token rotation, httpOnly cookies. Admin alag subdomain par, role-based (RBAC), har admin action `audit-logs` me.
11. **Shiprocket token** Redis me cache karo (240 ghante validity, 230h par refresh), har call par naya login nahi.
12. **Turborepo:** `turbo.json` me `build` ko `dependsOn: ["^build"]`, taaki shared packages pehle build hon.
13. **Secrets** sirf `.env` me. `.env.example` me sirf naam.
14. **Reference sites ka** logo, naam, photos, text copy nahi. Apna brand `docs/05-design/brand` me.

## Agent skills aur guides (Step 0, sabse pehle)
- `CLAUDE.md` aur `AGENTS.md` (root): agent hamesha padhega.
- `agent-guides/task-guide.md`: TASK-WISE guide. Har kaam (setup se deploy tak, admin panel bhi) ke liye files, skills, reference, steps aur done-check. Pehle yahi dekho.
- `.claude/skills/<name>/SKILL.md`: 8 project skills, jab zarurat ho tab load hoti hain (payments, inventory, india-compliance, security, admin-panel, storefront-quality, monorepo, agent-common-mistakes).
- `agent-guides/README.md`: external repos aur docs ke links. Unhe copy nahi karna, source se install ya padhna.
- `agent-guides/mistakes-log.md`: agent ki har galti yahan likho, phir related skill me rule jodo.

## Payment flow (UPI QR per order)
Har payment try ke liye alag single-use fixed-amount QR, amount se match nahi balki QR/attempt id se. Status sirf verified webhook ya server-side lookup se `paid` hota hai. Checkout page live status dikhata hai (paid / failed / expired). Details: `.claude/skills/ecommerce-payments/SKILL.md` aur `docs/03-architecture/adr/ADR-0010-upi-qr-per-order.md`.

## Step to folder map
| Step | Kaam | Kahan banega |
|------|------|--------------|
| 0 | Agent setup (rules, skills, guides) | `CLAUDE.md`, `AGENTS.md`, `.claude/skills/`, `agent-guides/` |
| 1 | Requirement analysis | `docs/00-overview`, `docs/01-requirements` |
| 2 | Planning | `docs/02-planning` (MVP scope yahin) |
| 3 | Architecture aur system design | `docs/03-architecture` (ADRs yahin) |
| 4 | Data design (DFD, ERD) | `docs/04-data` aur `database/prisma/schema.prisma` |
| 5 | UI/UX design | `docs/05-design` |
| 6 | API design | `docs/06-api` |
| 7 | Security design | `docs/07-security` |
| 8 | Development | `database/`, `apps/api`, `apps/web`, `apps/admin`, `packages/` (pehle Phase 1) |
| 9 | Testing | `docs/08-testing`, `tests/`, aur har module ki `*.test.ts` |
| 10 | DevOps aur deployment | `docs/09-devops`, `docs/10-deployment`, `infra/`, `.github/workflows/` |
| 11 | Maintenance | `docs/11-maintenance` |

## Complete tree
```
ecommerce-store/
├── .claude/   # Claude Code project config  [Step 0]
│   └── skills/
│       ├── admin-panel/
│       │   └── SKILL.md   # Project skill: admin panel kaise banana hai (RBAC, audit, orders, catalog, safety)  [Step 0]
│       ├── agent-common-mistakes/
│       │   └── SKILL.md   # Project skill: AI agent ki common galtiyan jo nahi karni  [Step 0]
│       ├── ecommerce-payments/
│       │   └── SKILL.md   # Project skill: Payments, UPI QR, webhooks, refunds, payment status: kya karna aur kya nahi  [Step 0]
│       ├── india-compliance/
│       │   └── SKILL.md   # Project skill: GST invoice, DPDP consent/erasure, policy pages  [Step 0]
│       ├── inventory-concurrency/
│       │   └── SKILL.md   # Project skill: Stock decrement, reservation, race conditions  [Step 0]
│       ├── monorepo-conventions/
│       │   └── SKILL.md   # Project skill: Folder rules, 5-file module pattern, shared validation, docs-first  [Step 0]
│       ├── security-baseline/
│       │   └── SKILL.md   # Project skill: Auth, tokens, RBAC, uploads, secrets, OWASP basics  [Step 0]
│       └── storefront-quality/
│           └── SKILL.md   # Project skill: Website quality: original design, accessibility, speed, SEO, real UX states  [Step 0]
├── .github/
│   ├── workflows/
│   │   ├── ci.yml   # Push par turbo lint + test + build  [Step 10]
│   │   ├── deploy.yml   # Main branch par auto deploy  [Step 10]
│   │   └── security.yml   # Dependency aur secret scanning  [Step 10]
│   ├── ISSUE_TEMPLATE/   # Bug / feature issue templates  [Step 10]
│   └── PULL_REQUEST_TEMPLATE.md   # PR checklist (doc update hua? test hua?)  [Step 10]
├── agent-guides/   # Agent ke liye reference: external links aur galtiyon ka log  [Step 0]
│   ├── mistakes-log.md   # Agent galti kare to yahan likho, phir related skill me rule add karo  [Step 0]
│   ├── README.md   # External repos/docs ke links aur unhe kaise use karna hai  [Step 0]
│   └── task-guide.md   # TASK-WISE guide: har kaam ke liye files, skills, reference, steps, done-check  [Step 0]
├── apps/
│   ├── admin/   # Admin panel (Next.js) - alag subdomain par deploy (admin.yourdomain)  [Step 8]
│   │   ├── src/
│   │   │   ├── app/   # Admin pages
│   │   │   │   ├── audit-logs/
│   │   │   │   │   └── page.tsx   # Kisne kya badla  [Step 8]
│   │   │   │   ├── banners/
│   │   │   │   │   └── page.tsx   # Homepage banners [P2]  [Step 8]
│   │   │   │   ├── categories/
│   │   │   │   │   └── page.tsx   # Manage categories  [Step 8]
│   │   │   │   ├── coupons/
│   │   │   │   │   └── page.tsx   # Coupons [P2]  [Step 8]
│   │   │   │   ├── customers/
│   │   │   │   │   └── page.tsx   # Customers  [Step 8]
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx   # Sales overview, charts  [Step 8]
│   │   │   │   ├── inventory/
│   │   │   │   │   └── page.tsx   # Stock management  [Step 8]
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx   # Admin login (2FA recommended)  [Step 8]
│   │   │   │   ├── orders/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   └── page.tsx   # Order detail, status update, refund, invoice  [Step 8]
│   │   │   │   │   └── page.tsx   # All orders  [Step 8]
│   │   │   │   ├── pages/
│   │   │   │   │   └── page.tsx   # CMS pages [P2]  [Step 8]
│   │   │   │   ├── products/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   └── page.tsx   # Edit product  [Step 8]
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx   # Add product  [Step 8]
│   │   │   │   │   └── page.tsx   # Product list  [Step 8]
│   │   │   │   ├── reports/
│   │   │   │   │   └── page.tsx   # Reports [P2]  [Step 8]
│   │   │   │   ├── reviews/
│   │   │   │   │   └── page.tsx   # Review moderation [P2]  [Step 8]
│   │   │   │   ├── settings/
│   │   │   │   │   └── page.tsx   # Store settings, shipping, tax, payment  [Step 8]
│   │   │   │   └── staff/
│   │   │   │       └── page.tsx   # Staff accounts aur roles (RBAC)  [Step 8]
│   │   │   ├── components/   # Admin UI components (tables, forms, charts)  [Step 8]
│   │   │   ├── hooks/   # Admin hooks  [Step 8]
│   │   │   ├── lib/   # Helpers  [Step 8]
│   │   │   ├── services/   # Admin API calls  [Step 8]
│   │   │   └── types/   # Types  [Step 8]
│   │   ├── .env.example   # Admin env template  [Step 8]
│   │   ├── Dockerfile   # Admin Docker image  [Step 8]
│   │   └── package.json   # Admin dependencies  [Step 8]
│   ├── api/   # Backend API (Node.js + TypeScript + Express), routes /api/v1/...  [Step 8]
│   │   ├── src/
│   │   │   ├── config/   # Env, db, redis, queue, storage, logger config
│   │   │   │   ├── db.ts   # Database connection  [Step 8]
│   │   │   │   ├── env.ts   # Environment variables validation  [Step 8]
│   │   │   │   ├── logger.ts   # Structured logging  [Step 8]
│   │   │   │   ├── queue.ts   # BullMQ connection setup  [Step 8]
│   │   │   │   ├── redis.ts   # Redis connection  [Step 8]
│   │   │   │   └── storage.ts   # S3/R2 client config  [Step 8]
│   │   │   ├── integrations/
│   │   │   │   ├── gateway/   # Self-hosted UPI gateway (koi payment aggregator nahi)
│   │   │   │   │   └── README.md   # Observer setup: Android SMS app / Gmail watcher / simulator  [Step 8]
│   │   │   │   ├── email/   # Email provider + templates  [Step 8]
│   │   │   │   ├── shiprocket/   # Shipping client; token Redis me cache (240h validity)  [Step 8]
│   │   │   │   ├── sms/   # SMS / OTP provider  [Step 8]
│   │   │   │   ├── storage/   # S3 / Cloudflare R2 presigned URL generator  [Step 8]
│   │   │   │   └── whatsapp/   # WhatsApp notifications  [Step 8]
│   │   │   ├── jobs/
│   │   │   │   ├── queues/   # BullMQ queue definitions (email, sms, whatsapp, invoice)
│   │   │   │   │   └── email.queue.ts   # Email queue  [Step 8]
│   │   │   │   ├── schedulers/   # Repeating jobs: abandoned-cart, expired stock reservation release, stock alerts
│   │   │   │   │   ├── abandoned-cart.scheduler.ts   # Abandoned cart reminder  [Step 8]
│   │   │   │   │   ├── expire-qr.scheduler.ts   # Expired QR ko expired mark karna (auto-expiry par webhook nahi aata)  [Step 8]
│   │   │   │   │   ├── reconcile-payments.scheduler.ts   # Pending attempts ko provider API se verify (missed webhook safety net)  [Step 8]
│   │   │   │   │   └── release-expired-stock.scheduler.ts   # Unpaid orders ka reserved stock wapas release  [Step 8]
│   │   │   │   └── workers/   # Queue workers jo actual kaam karte hain
│   │   │   │       └── email.worker.ts   # Email worker  [Step 8]
│   │   │   ├── middlewares/   # auth, role, validate, rate-limit, idempotency, request-id, error-handler
│   │   │   │   ├── auth.middleware.ts   # Token verify, current user attach  [Step 8]
│   │   │   │   ├── error.middleware.ts   # Central error handler  [Step 8]
│   │   │   │   ├── idempotency.middleware.ts   # Idempotency-Key: double-click par double order nahi  [Step 8]
│   │   │   │   ├── rate-limit.middleware.ts   # Rate limiting (login, OTP, checkout)  [Step 8]
│   │   │   │   ├── request-id.middleware.ts   # Har request ka ID (logs trace karne ke liye)  [Step 8]
│   │   │   │   ├── role.middleware.ts   # Admin/staff/customer role check (RBAC)  [Step 8]
│   │   │   │   └── validate.middleware.ts   # Zod validation runner  [Step 8]
│   │   │   ├── modules/   # Har feature ka alag module (5-file pattern). [P1]=launch se pehle, [P2]=launch ke baad
│   │   │   │   ├── addresses/   # [P1] Saved shipping addresses
│   │   │   │   │   ├── addresses.controller.ts   # addresses: Request/response handling  [Step 8]
│   │   │   │   │   ├── addresses.routes.ts   # addresses: URL routes  [Step 8]
│   │   │   │   │   ├── addresses.schema.ts   # addresses: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── addresses.service.ts   # addresses: Business logic  [Step 8]
│   │   │   │   │   └── addresses.test.ts   # addresses: Module tests  [Step 8]
│   │   │   │   ├── analytics/   # [P2] Sales aur customer reports (admin)
│   │   │   │   │   ├── analytics.controller.ts   # analytics: Request/response handling  [Step 8]
│   │   │   │   │   ├── analytics.routes.ts   # analytics: URL routes  [Step 8]
│   │   │   │   │   ├── analytics.schema.ts   # analytics: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── analytics.service.ts   # analytics: Business logic  [Step 8]
│   │   │   │   │   └── analytics.test.ts   # analytics: Module tests  [Step 8]
│   │   │   │   ├── audit-logs/   # [P1] Admin/staff ne kya badla uska record
│   │   │   │   │   ├── audit-logs.controller.ts   # audit-logs: Request/response handling  [Step 8]
│   │   │   │   │   ├── audit-logs.routes.ts   # audit-logs: URL routes  [Step 8]
│   │   │   │   │   ├── audit-logs.schema.ts   # audit-logs: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── audit-logs.service.ts   # audit-logs: Business logic  [Step 8]
│   │   │   │   │   └── audit-logs.test.ts   # audit-logs: Module tests  [Step 8]
│   │   │   │   ├── auth/   # [P1] Register, login, logout, refresh token rotation, OTP, forgot/reset password, email verify
│   │   │   │   │   ├── auth.controller.ts   # auth: Request/response handling  [Step 8]
│   │   │   │   │   ├── auth.routes.ts   # auth: URL routes  [Step 8]
│   │   │   │   │   ├── auth.schema.ts   # auth: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── auth.service.ts   # auth: Business logic  [Step 8]
│   │   │   │   │   └── auth.test.ts   # auth: Module tests  [Step 8]
│   │   │   │   ├── banners/   # [P2] Homepage banners aur sections
│   │   │   │   │   ├── banners.controller.ts   # banners: Request/response handling  [Step 8]
│   │   │   │   │   ├── banners.routes.ts   # banners: URL routes  [Step 8]
│   │   │   │   │   ├── banners.schema.ts   # banners: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── banners.service.ts   # banners: Business logic  [Step 8]
│   │   │   │   │   └── banners.test.ts   # banners: Module tests  [Step 8]
│   │   │   │   ├── cart/   # [P1] Cart add/update/remove, guest cart merge, server-side price recompute
│   │   │   │   │   ├── cart.controller.ts   # cart: Request/response handling  [Step 8]
│   │   │   │   │   ├── cart.routes.ts   # cart: URL routes  [Step 8]
│   │   │   │   │   ├── cart.schema.ts   # cart: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── cart.service.ts   # cart: Business logic  [Step 8]
│   │   │   │   │   └── cart.test.ts   # cart: Module tests  [Step 8]
│   │   │   │   ├── categories/   # [P1] Category aur sub-category
│   │   │   │   │   ├── categories.controller.ts   # categories: Request/response handling  [Step 8]
│   │   │   │   │   ├── categories.routes.ts   # categories: URL routes  [Step 8]
│   │   │   │   │   ├── categories.schema.ts   # categories: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── categories.service.ts   # categories: Business logic  [Step 8]
│   │   │   │   │   └── categories.test.ts   # categories: Module tests  [Step 8]
│   │   │   │   ├── cms/   # [P2] Editable static pages: about, FAQ, blog
│   │   │   │   │   ├── cms.controller.ts   # cms: Request/response handling  [Step 8]
│   │   │   │   │   ├── cms.routes.ts   # cms: URL routes  [Step 8]
│   │   │   │   │   ├── cms.schema.ts   # cms: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── cms.service.ts   # cms: Business logic  [Step 8]
│   │   │   │   │   └── cms.test.ts   # cms: Module tests  [Step 8]
│   │   │   │   ├── consents/   # [P1] DPDP consent logs aur erasure requests
│   │   │   │   │   ├── consents.controller.ts   # consents: Request/response handling  [Step 8]
│   │   │   │   │   ├── consents.routes.ts   # consents: URL routes  [Step 8]
│   │   │   │   │   ├── consents.schema.ts   # consents: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── consents.service.ts   # consents: Business logic  [Step 8]
│   │   │   │   │   └── consents.test.ts   # consents: Module tests  [Step 8]
│   │   │   │   ├── coupons/   # [P2] Discount codes aur rules
│   │   │   │   │   ├── coupons.controller.ts   # coupons: Request/response handling  [Step 8]
│   │   │   │   │   ├── coupons.routes.ts   # coupons: URL routes  [Step 8]
│   │   │   │   │   ├── coupons.schema.ts   # coupons: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── coupons.service.ts   # coupons: Business logic  [Step 8]
│   │   │   │   │   └── coupons.test.ts   # coupons: Module tests  [Step 8]
│   │   │   │   ├── inventory/   # [P1] Stock per variant: atomic decrement, reservation, expiry release
│   │   │   │   │   ├── inventory.controller.ts   # inventory: Request/response handling  [Step 8]
│   │   │   │   │   ├── inventory.routes.ts   # inventory: URL routes  [Step 8]
│   │   │   │   │   ├── inventory.schema.ts   # inventory: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── inventory.service.ts   # inventory: Business logic  [Step 8]
│   │   │   │   │   └── inventory.test.ts   # inventory: Module tests  [Step 8]
│   │   │   │   ├── invoices/   # [P1] GST invoice (GSTIN, HSN, CGST/SGST/IGST), PDF generate
│   │   │   │   │   ├── invoices.controller.ts   # invoices: Request/response handling  [Step 8]
│   │   │   │   │   ├── invoices.routes.ts   # invoices: URL routes  [Step 8]
│   │   │   │   │   ├── invoices.schema.ts   # invoices: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── invoices.service.ts   # invoices: Business logic  [Step 8]
│   │   │   │   │   └── invoices.test.ts   # invoices: Module tests  [Step 8]
│   │   │   │   ├── notifications/   # [P1] Email/SMS/WhatsApp triggers (queue ke through)
│   │   │   │   │   ├── notifications.controller.ts   # notifications: Request/response handling  [Step 8]
│   │   │   │   │   ├── notifications.routes.ts   # notifications: URL routes  [Step 8]
│   │   │   │   │   ├── notifications.schema.ts   # notifications: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── notifications.service.ts   # notifications: Business logic  [Step 8]
│   │   │   │   │   └── notifications.test.ts   # notifications: Module tests  [Step 8]
│   │   │   │   ├── orders/   # [P1] Create order (idempotent), history, cancel, return/refund
│   │   │   │   │   ├── orders.controller.ts   # orders: Request/response handling  [Step 8]
│   │   │   │   │   ├── orders.routes.ts   # orders: URL routes  [Step 8]
│   │   │   │   │   ├── orders.schema.ts   # orders: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── orders.service.ts   # orders: Business logic  [Step 8]
│   │   │   │   │   └── orders.test.ts   # orders: Module tests  [Step 8]
│   │   │   │   ├── gateway/   # [P1] Self-hosted UPI gateway: single-use QR, single-slot FIFO queue, dual timers, observers
│   │   │   │   │   ├── gateway.service.ts   # Session lifecycle, queue promotion, timers, settle  [Step 8]
│   │   │   │   │   ├── gateway.qr.ts   # `upi://pay?...` string + vector SVG QR (par-order, fixed amount)  [Step 8]
│   │   │   │   │   ├── sms-parser.ts   # Bank SMS/email → amountPaise + UTR (HDFC/ICICI/SBI/Paytm formats)  [Step 8]
│   │   │   │   │   ├── observers.service.ts   # Exact-amount attribution, cross-source verification, verdicts  [Step 8]
│   │   │   │   │   ├── observers.controller.ts   # Suspicious/unmatched read views  [Step 8]
│   │   │   │   │   ├── observers.routes.ts   # Observer read routes  [Step 8]
│   │   │   │   │   └── observers.test.ts   # Observer matching + verification tests  [Step 8]
│   │   │   │   ├── admin/   # [P1] Admin routes: merchant VPA + webhook config (x-admin-token)
│   │   │   │   ├── payments/   # [P1] Thin API over gateway: start, status, cancel, attempts, merchant webhook delivery
│   │   │   │   │   ├── merchant-webhook.service.ts   # HMAC-signed payment.success + retry backoff  [Step 8]
│   │   │   │   │   ├── payments.controller.ts   # payments: Request/response handling  [Step 8]
│   │   │   │   │   ├── payments.routes.ts   # payments: URL routes  [Step 8]
│   │   │   │   │   ├── payments.schema.ts   # payments: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── payments.service.ts   # payments: Business logic  [Step 8]
│   │   │   │   │   └── payments.test.ts   # payments: Module tests  [Step 8]
│   │   │   │   ├── products/   # [P1] Products, variants (size/color), images, basic search/filter
│   │   │   │   │   ├── products.controller.ts   # products: Request/response handling  [Step 8]
│   │   │   │   │   ├── products.routes.ts   # products: URL routes  [Step 8]
│   │   │   │   │   ├── products.schema.ts   # products: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── products.service.ts   # products: Business logic  [Step 8]
│   │   │   │   │   └── products.test.ts   # products: Module tests  [Step 8]
│   │   │   │   ├── reviews/   # [P2] Ratings aur reviews
│   │   │   │   │   ├── reviews.controller.ts   # reviews: Request/response handling  [Step 8]
│   │   │   │   │   ├── reviews.routes.ts   # reviews: URL routes  [Step 8]
│   │   │   │   │   ├── reviews.schema.ts   # reviews: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── reviews.service.ts   # reviews: Business logic  [Step 8]
│   │   │   │   │   └── reviews.test.ts   # reviews: Module tests  [Step 8]
│   │   │   │   ├── search/   # [P2] Advanced search (Meilisearch/Elastic) - basic search P1 me products me hai
│   │   │   │   │   ├── search.controller.ts   # search: Request/response handling  [Step 8]
│   │   │   │   │   ├── search.routes.ts   # search: URL routes  [Step 8]
│   │   │   │   │   ├── search.schema.ts   # search: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── search.service.ts   # search: Business logic  [Step 8]
│   │   │   │   │   └── search.test.ts   # search: Module tests  [Step 8]
│   │   │   │   ├── settings/   # [P1] Store settings: shipping rules, tax, payment toggles
│   │   │   │   │   ├── settings.controller.ts   # settings: Request/response handling  [Step 8]
│   │   │   │   │   ├── settings.routes.ts   # settings: URL routes  [Step 8]
│   │   │   │   │   ├── settings.schema.ts   # settings: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── settings.service.ts   # settings: Business logic  [Step 8]
│   │   │   │   │   └── settings.test.ts   # settings: Module tests  [Step 8]
│   │   │   │   ├── shipping/   # [P1] Shipping charges, pincode serviceability, tracking
│   │   │   │   │   ├── shipping.controller.ts   # shipping: Request/response handling  [Step 8]
│   │   │   │   │   ├── shipping.routes.ts   # shipping: URL routes  [Step 8]
│   │   │   │   │   ├── shipping.schema.ts   # shipping: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── shipping.service.ts   # shipping: Business logic  [Step 8]
│   │   │   │   │   └── shipping.test.ts   # shipping: Module tests  [Step 8]
│   │   │   │   ├── uploads/   # [P1] Presigned upload URL dena (file API se NAHI guzarti)
│   │   │   │   │   ├── uploads.controller.ts   # uploads: Request/response handling  [Step 8]
│   │   │   │   │   ├── uploads.routes.ts   # uploads: URL routes  [Step 8]
│   │   │   │   │   ├── uploads.schema.ts   # uploads: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── uploads.service.ts   # uploads: Business logic  [Step 8]
│   │   │   │   │   └── uploads.test.ts   # uploads: Module tests  [Step 8]
│   │   │   │   ├── users/   # [P1] User profile, change password, account delete (DPDP erasure)
│   │   │   │   │   ├── users.controller.ts   # users: Request/response handling  [Step 8]
│   │   │   │   │   ├── users.routes.ts   # users: URL routes  [Step 8]
│   │   │   │   │   ├── users.schema.ts   # users: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │   │   ├── users.service.ts   # users: Business logic  [Step 8]
│   │   │   │   │   └── users.test.ts   # users: Module tests  [Step 8]
│   │   │   │   └── wishlist/   # [P2] Wishlist
│   │   │   │       ├── wishlist.controller.ts   # wishlist: Request/response handling  [Step 8]
│   │   │   │       ├── wishlist.routes.ts   # wishlist: URL routes  [Step 8]
│   │   │   │       ├── wishlist.schema.ts   # wishlist: API-only schemas (shared rules packages/validation se import)  [Step 8]
│   │   │   │       ├── wishlist.service.ts   # wishlist: Business logic  [Step 8]
│   │   │   │       └── wishlist.test.ts   # wishlist: Module tests  [Step 8]
│   │   │   ├── utils/   # Helper functions (hash, token, slug, pagination, response, money)
│   │   │   │   └── money.ts   # Paise <-> rupees conversion (kabhi float nahi)  [Step 8]
│   │   │   ├── webhooks/   # Third-party webhooks (alag folder: raw body chahiye, modules se isolated)
│   │   │   │   ├── observer.webhook.ts   # Bank observer ingest: HMAC verify, UTR/message dedupe, raw SMS  [Step 8]
│   │   │   │   ├── README.md   # Rule: express.raw() se mount, HMAC verify, event-id dedupe, turant 2xx, kaam queue me  [Step 8]
│   │   │   │   └── shiprocket.webhook.ts   # Shiprocket tracking status updates  [Step 8]
│   │   │   ├── app.ts   # Express app: webhooks pehle (raw body), phir express.json, phir modules  [Step 8]
│   │   │   ├── constants/   # Roles, order status, payment status, error codes  [Step 8]
│   │   │   ├── events/   # Event handlers (order placed, payment success, etc.)  [Step 8]
│   │   │   ├── server.ts   # Server start (port listen) + graceful shutdown  [Step 8]
│   │   │   ├── types/   # Backend ke shared TypeScript types  [Step 8]
│   │   │   └── worker.ts   # Alag process: BullMQ workers chalata hai (API se alag scale hota hai)  [Step 8]
│   │   ├── .env.example   # API env variables template  [Step 8]
│   │   ├── Dockerfile   # API ka Docker image  [Step 8]
│   │   ├── package.json   # API dependencies aur scripts  [Step 8]
│   │   └── tsconfig.json   # TypeScript config  [Step 8]
│   └── web/   # Customer storefront (Next.js + TypeScript + Tailwind)  [Step 8]
│       ├── public/
│       │   ├── fonts/   # Fonts  [Step 8]
│       │   ├── icons/   # Icons aur favicon  [Step 8]
│       │   └── images/   # Static images (apna logo/branding)  [Step 8]
│       ├── src/
│       │   ├── app/   # Pages / routes (Next.js App Router)
│       │   │   ├── (auth)/
│       │   │   │   ├── forgot-password/
│       │   │   │   │   └── page.tsx   # Forgot password  [Step 8]
│       │   │   │   ├── login/
│       │   │   │   │   └── page.tsx   # Login  [Step 8]
│       │   │   │   ├── register/
│       │   │   │   │   └── page.tsx   # Sign up (consent checkbox ke saath)  [Step 8]
│       │   │   │   ├── reset-password/
│       │   │   │   │   └── page.tsx   # Reset password  [Step 8]
│       │   │   │   └── verify-email/
│       │   │   │       └── page.tsx   # Email verification  [Step 8]
│       │   │   ├── (shop)/
│       │   │   │   ├── cart/
│       │   │   │   │   └── page.tsx   # Cart  [Step 8]
│       │   │   │   ├── category/
│       │   │   │   │   └── [slug]/
│       │   │   │   │       └── page.tsx   # Category page  [Step 8]
│       │   │   │   ├── checkout/
│       │   │   │   │   ├── success/
│       │   │   │   │   │   └── page.tsx   # Order success (status server se confirm, redirect par bharosa nahi)  [Step 8]
│       │   │   │   │   └── page.tsx   # Checkout (address, shipping, payment)  [Step 8]
│       │   │   │   ├── products/
│       │   │   │   │   ├── [slug]/
│       │   │   │   │   │   └── page.tsx   # Product detail  [Step 8]
│       │   │   │   │   └── page.tsx   # Product listing + filters  [Step 8]
│       │   │   │   ├── search/
│       │   │   │   │   └── page.tsx   # Search results  [Step 8]
│       │   │   │   ├── wishlist/
│       │   │   │   │   └── page.tsx   # Wishlist [P2]  [Step 8]
│       │   │   │   └── page.tsx   # Home page  [Step 8]
│       │   │   ├── account/
│       │   │   │   ├── addresses/
│       │   │   │   │   └── page.tsx   # Manage addresses  [Step 8]
│       │   │   │   ├── orders/
│       │   │   │   │   ├── [id]/
│       │   │   │   │   │   └── page.tsx   # Order detail + tracking + invoice download  [Step 8]
│       │   │   │   │   └── page.tsx   # Order history  [Step 8]
│       │   │   │   ├── privacy/
│       │   │   │   │   └── page.tsx   # Consent manage, data download, account delete (DPDP)  [Step 8]
│       │   │   │   └── page.tsx   # Profile  [Step 8]
│       │   │   ├── pages/
│       │   │   │   └── [slug]/
│       │   │   │       └── page.tsx   # About, contact, FAQ  [Step 8]
│       │   │   ├── policies/
│       │   │   │   └── [slug]/
│       │   │   │       └── page.tsx   # Privacy, terms, refund, shipping policy pages (payment gateway approval ke liye bhi chahiye)  [Step 8]
│       │   │   ├── layout.tsx   # Root layout (header, footer)  [Step 8]
│       │   │   ├── not-found.tsx   # 404 page  [Step 8]
│       │   │   ├── robots.ts   # SEO robots  [Step 8]
│       │   │   └── sitemap.ts   # SEO sitemap  [Step 8]
│       │   ├── components/
│       │   │   ├── checkout/   # Address form, Payment step, Order summary
│       │   │   │   └── QrPayment.tsx   # QR dikhana + live status (paid/failed/expired) + naya QR button  [Step 8]
│       │   │   ├── account/   # Account sidebar, Order card  [Step 8]
│       │   │   ├── auth/   # Login/Register forms  [Step 8]
│       │   │   ├── cart/   # CartDrawer, CartItem  [Step 8]
│       │   │   ├── common/   # Loader, Pagination, Breadcrumb, SEO, CookieConsent  [Step 8]
│       │   │   ├── home/   # Hero banner, Collections, Featured sections  [Step 8]
│       │   │   ├── layout/   # Header, Footer, Navbar, Mobile menu  [Step 8]
│       │   │   ├── product/   # ProductCard, Gallery, SizeSelector, Filters  [Step 8]
│       │   │   └── ui/   # Button, Input, Modal, Badge (reusable basics)  [Step 8]
│       │   ├── content/
│       │   │   └── policies/   # Policy pages ka text (markdown): privacy, terms, refund, shipping
│       │   │       ├── privacy-policy.md   # Apna policy text (copy nahi karna)  [Step 8]
│       │   │       ├── refund-and-return-policy.md   # Apna policy text (copy nahi karna)  [Step 8]
│       │   │       ├── shipping-policy.md   # Apna policy text (copy nahi karna)  [Step 8]
│       │   │       └── terms-and-conditions.md   # Apna policy text (copy nahi karna)  [Step 8]
│       │   ├── hooks/   # Custom hooks (useCart, useAuth, useDebounce)
│       │   │   └── usePaymentStatus.ts   # Payment status polling  [Step 8]
│       │   ├── styles/   # Global CSS
│       │   │   └── globals.css   # Global styles aur Tailwind imports  [Step 8]
│       │   ├── config/   # Site config (name, nav links, constants)  [Step 8]
│       │   ├── lib/   # API client, auth helpers, formatters (paise -> rupees display)  [Step 8]
│       │   ├── middleware.ts   # Route protection (account pages login ke baad)  [Step 8]
│       │   ├── services/   # API calls: products, cart, orders, auth  [Step 8]
│       │   ├── store/   # Global state (cart, user)  [Step 8]
│       │   ├── types/   # Frontend TypeScript types  [Step 8]
│       │   └── utils/   # Helper functions  [Step 8]
│       ├── .env.example   # Web env variables template  [Step 8]
│       ├── Dockerfile   # Web Docker image  [Step 8]
│       ├── next.config.js   # Next.js config (image domains, headers)  [Step 8]
│       ├── package.json   # Web dependencies  [Step 8]
│       ├── tailwind.config.ts   # Theme: colors, fonts, spacing (design tokens)  [Step 8]
│       └── tsconfig.json   # TypeScript config  [Step 8]
├── database/   # Database: schema, migrations, DB-level safety constraints, seed data  [Step 8]
│   ├── prisma/
│   │   └── schema.prisma   # Poora DB schema (tables, relations). Paisa integer paise me  [Step 8]
│   ├── scripts/   # Backup, restore, reset scripts  [Step 8]
│   │   ├── backup.sh   # DB backup script  [Step 8]
│   │   └── restore.sh   # DB restore script  [Step 8]
│   ├── seeds/   # Demo data: categories, sample products, admin user  [Step 8]
│   │   └── seed.ts   # Seed script entry  [Step 8]
│   ├── sql/
│   │   └── constraints.sql   # DB safety: CHECK stock >= 0, unique webhook_event_id, unique idempotency key  [Step 8]
│   ├── migrations/   # Auto-generated migration files  [Step 8]
│   └── README.md   # DB setup, migration aur backup ka tareeka  [Step 8]
├── docs/   # Saare project documents (code se pehle yahan banenge)
│   ├── 00-overview/   # Vision, scope, glossary, reference sites ki study  [Step 1]
│   │   ├── glossary.md   # glossary document  [Step 1]
│   │   ├── reference-sites-analysis.md   # reference sites analysis document  [Step 1]
│   │   ├── scope.md   # scope document  [Step 1]
│   │   └── vision.md   # vision document  [Step 1]
│   ├── 01-requirements/   # Requirements: BRD, SRS, user stories, use cases  [Step 1]
│   │   ├── BRD.md   # BRD document  [Step 1]
│   │   ├── competitor-analysis.md   # competitor analysis document  [Step 1]
│   │   ├── feature-list.md   # feature list document  [Step 1]
│   │   ├── non-functional-requirements.md   # non functional requirements document  [Step 1]
│   │   ├── SRS.md   # SRS document  [Step 1]
│   │   ├── traceability-matrix.md   # traceability matrix document  [Step 1]
│   │   ├── use-cases.md   # use cases document  [Step 1]
│   │   └── user-stories.md   # user stories document  [Step 1]
│   ├── 02-planning/   # Planning: roadmap, MVP scope (Phase 1/2), WBS, sprints, risks  [Step 2]
│   │   ├── estimation.md   # estimation document  [Step 2]
│   │   ├── mvp-scope.md   # mvp scope document  [Step 2]
│   │   ├── risk-register.md   # risk register document  [Step 2]
│   │   ├── roadmap.md   # roadmap document  [Step 2]
│   │   ├── sprint-plan.md   # sprint plan document  [Step 2]
│   │   ├── team-and-roles.md   # team and roles document  [Step 2]
│   │   └── WBS.md   # WBS document  [Step 2]
│   ├── 03-architecture/   # Architecture: HLD, LLD, C4, API conventions, ADRs, tech stack  [Step 3]
│   │   ├── adr/
│   │   │   ├── ADR-0001-tech-stack.md   # adr/ADR 0001 tech stack document  [Step 3]
│   │   │   ├── ADR-0002-database.md   # adr/ADR 0002 database document  [Step 3]
│   │   │   ├── ADR-0003-auth-strategy.md   # adr/ADR 0003 auth strategy document  [Step 3]
│   │   │   ├── ADR-0004-inventory-concurrency.md   # adr/ADR 0004 inventory concurrency document  [Step 3]
│   │   │   ├── ADR-0005-payments-and-webhooks.md   # adr/ADR 0005 payments and webhooks document  [Step 3]
│   │   │   ├── ADR-0006-file-uploads-presigned.md   # adr/ADR 0006 file uploads presigned document  [Step 3]
│   │   │   ├── ADR-0007-queues-and-jobs.md   # adr/ADR 0007 queues and jobs document  [Step 3]
│   │   │   ├── ADR-0008-monorepo-tooling.md   # adr/ADR 0008 monorepo tooling document  [Step 3]
│   │   │   ├── ADR-0009-money-as-integer-paise.md   # adr/ADR 0009 money as integer paise document  [Step 3]
│   │   │   └── ADR-0010-upi-qr-per-order.md   # Decision: har order ke liye alag single-use QR, amount se match nahi  [Step 3]
│   │   ├── api-conventions.md   # api conventions document  [Step 3]
│   │   ├── c4-diagrams.md   # c4 diagrams document  [Step 3]
│   │   ├── component-diagram.md   # component diagram document  [Step 3]
│   │   ├── deployment-diagram.md   # deployment diagram document  [Step 3]
│   │   ├── HLD.md   # HLD document  [Step 3]
│   │   ├── LLD.md   # LLD document  [Step 3]
│   │   ├── payment-flow.md   # Payment flow diagram: order -> QR -> webhook -> paid  [Step 3]
│   │   ├── sequence-diagrams.md   # sequence diagrams document  [Step 3]
│   │   ├── system-architecture.md   # system architecture document  [Step 3]
│   │   └── tech-stack.md   # tech stack document  [Step 3]
│   ├── 04-data/   # Data design: DFD, ERD, data dictionary, schema, stock aur GST rules  [Step 4]
│   │   ├── data-dictionary.md   # data dictionary document  [Step 4]
│   │   ├── data-retention.md   # data retention document  [Step 4]
│   │   ├── db-schema.md   # db schema document  [Step 4]
│   │   ├── dfd-level-0.md   # dfd level 0 document  [Step 4]
│   │   ├── dfd-level-1.md   # dfd level 1 document  [Step 4]
│   │   ├── dfd-level-2.md   # dfd level 2 document  [Step 4]
│   │   ├── erd.md   # erd document  [Step 4]
│   │   ├── gst-and-tax-model.md   # gst and tax model document  [Step 4]
│   │   ├── inventory-and-stock-rules.md   # inventory and stock rules document  [Step 4]
│   │   ├── migration-plan.md   # migration plan document  [Step 4]
│   │   └── payment-state-machine.md   # created -> pending -> paid / failed / expired / refunded  [Step 4]
│   ├── 05-design/   # UI/UX: sitemap, flows, wireframes, design system, brand  [Step 5]
│   │   ├── brand/
│   │   │   └── brand-guidelines.md   # brand/brand guidelines document  [Step 5]
│   │   ├── mockups/
│   │   │   └── README.md   # mockups/README document  [Step 5]
│   │   ├── wireframes/
│   │   │   └── README.md   # wireframes/README document  [Step 5]
│   │   ├── accessibility.md   # accessibility document  [Step 5]
│   │   ├── design-system.md   # design system document  [Step 5]
│   │   ├── sitemap.md   # sitemap document  [Step 5]
│   │   ├── style-guide.md   # style guide document  [Step 5]
│   │   └── user-flows.md   # user flows document  [Step 5]
│   ├── 06-api/   # API design: OpenAPI, endpoints, errors, auth flow, webhooks  [Step 6]
│   │   ├── auth-flow.md   # auth flow document  [Step 6]
│   │   ├── endpoints.md   # endpoints document  [Step 6]
│   │   ├── error-codes.md   # error codes document  [Step 6]
│   │   ├── openapi.yaml   # openapi document  [Step 6]
│   │   ├── payment-status-api.md   # GET payment status endpoint ka contract  [Step 6]
│   │   ├── rate-limits.md   # rate limits document  [Step 6]
│   │   └── webhooks.md   # webhooks document  [Step 6]
│   ├── 07-security/   # Security: auth, RBAC, tokens, threat model, webhook security, DPDP  [Step 7]
│   │   ├── authentication.md   # authentication document  [Step 7]
│   │   ├── authorization-rbac.md   # authorization rbac document  [Step 7]
│   │   ├── data-protection.md   # data protection document  [Step 7]
│   │   ├── india-compliance-dpdp.md   # india compliance dpdp document  [Step 7]
│   │   ├── payment-security.md   # payment security document  [Step 7]
│   │   ├── session-and-token-strategy.md   # session and token strategy document  [Step 7]
│   │   ├── threat-model.md   # threat model document  [Step 7]
│   │   └── webhook-security.md   # webhook security document  [Step 7]
│   ├── 08-testing/   # Testing: plan, cases, UAT, performance, security  [Step 9]
│   │   ├── performance-testing.md   # performance testing document  [Step 9]
│   │   ├── security-testing.md   # security testing document  [Step 9]
│   │   ├── test-cases.md   # test cases document  [Step 9]
│   │   ├── test-plan.md   # test plan document  [Step 9]
│   │   └── uat.md   # uat document  [Step 9]
│   ├── 09-devops/   # DevOps: CI/CD, environments, monitoring, backup  [Step 10]
│   │   ├── backup-dr.md   # backup dr document  [Step 10]
│   │   ├── ci-cd.md   # ci cd document  [Step 10]
│   │   ├── environments.md   # environments document  [Step 10]
│   │   ├── infra-as-code.md   # infra as code document  [Step 10]
│   │   └── monitoring-logging.md   # monitoring logging document  [Step 10]
│   ├── 10-deployment/   # Deployment: release, runbook, rollback, go-live  [Step 10]
│   │   ├── go-live-checklist.md   # go live checklist document  [Step 10]
│   │   ├── release-plan.md   # release plan document  [Step 10]
│   │   ├── rollback-plan.md   # rollback plan document  [Step 10]
│   │   └── runbook.md   # runbook document  [Step 10]
│   └── 11-maintenance/   # Maintenance: manuals, changelog, support, SEO  [Step 11]
│       ├── admin-guide.md   # admin guide document  [Step 11]
│       ├── changelog.md   # changelog document  [Step 11]
│       ├── seo-guide.md   # seo guide document  [Step 11]
│       ├── support-sop.md   # support sop document  [Step 11]
│       └── user-manual.md   # user manual document  [Step 11]
├── infra/   # Server aur deployment configuration  [Step 10]
│   ├── monitoring/   # Logs, uptime, error tracking config  [Step 10]
│   │   └── README.md   # Monitoring setup notes  [Step 10]
│   ├── nginx/
│   │   └── nginx.conf   # Reverse proxy, SSL, gzip, caching  [Step 10]
│   ├── scripts/   # Server setup aur deploy scripts  [Step 10]
│   │   └── deploy.sh   # Deploy script  [Step 10]
│   └── docker/   # Docker related files  [Step 10]
├── packages/   # Web, admin aur api ke beech shared code  [Step 8]
│   ├── api-client/   # Typed API client (OpenAPI se generate), web aur admin dono use karein  [Step 8]
│   │   ├── index.ts   # Client export  [Step 8]
│   │   └── package.json   # Package config  [Step 8]
│   ├── config/   # Shared eslint, prettier, tsconfig  [Step 8]
│   │   ├── eslint.config.js   # Shared lint rules  [Step 8]
│   │   ├── prettier.config.js   # Shared formatting rules  [Step 8]
│   │   └── tsconfig.base.json   # Base TS config  [Step 8]
│   ├── types/   # Shared TypeScript types (Product, Order, User)  [Step 8]
│   │   ├── index.ts   # Types export  [Step 8]
│   │   └── package.json   # Package config  [Step 8]
│   ├── ui/   # Shared UI components jo web aur admin dono me chahiye  [Step 8]
│   │   ├── index.ts   # Components export  [Step 8]
│   │   └── package.json   # Package config  [Step 8]
│   └── validation/   # Shared zod schemas: SINGLE source of truth (frontend + backend same rules)  [Step 8]
│       ├── index.ts   # Schemas export  [Step 8]
│       └── package.json   # Package config  [Step 8]
├── scripts/   # Dev helper scripts (setup, lint-all, generate-types)  [Step 8]
│   ├── setup-env.sh   # .env + secrets generate (VPA set) — gitignored  [Step 8]
│   ├── observer-simulator.ts   # Bank observer simulator: health / pay / flow / admin  [Step 8]
│   └── setup.sh   # Ek command me project setup  [Step 8]
├── tests/   # Cross-app tests (unit tests apne module ke saath hain)  [Step 9]
│   ├── integration/   # API + database integration tests  [Step 9]
│   │   ├── concurrent-same-amount-payments.test.ts   # 40 customers same amount: har payment apne order se match  [Step 9]
│   │   ├── inventory-concurrency.test.ts   # 100 parallel orders, 1 item stock: sirf 1 jeetna chahiye  [Step 9]
│   │   └── razorpay-webhook.test.ts   # Duplicate event, galat signature, replay tests  [Step 9]
│   ├── e2e/   # End-to-end: signup -> add to cart -> checkout -> payment  [Step 9]
│   ├── fixtures/   # Test data  [Step 9]
│   ├── performance/   # Load testing scripts  [Step 9]
│   └── security/   # Security test scripts  [Step 9]
├── .dockerignore   # Docker build me jo files nahi jaani chahiye
├── .editorconfig   # Editor formatting rules
├── .env.example   # Saari environment variables ka template (asli keys yahan NAHI)
├── .gitignore   # Git me jo files nahi jaani chahiye
├── .nvmrc   # Node version lock (sabke liye same version)
├── AGENTS.md   # AI agent ke rules: tech stack, critical engineering rules, kya karna/nahi karna
├── CLAUDE.md   # Claude Code entry file: AGENTS.md + STRUCTURE.md padho, skills ka pointer  [Step 0]
├── DECISIONS.md   # Har bade decision ka record (kya choose kiya aur kyun)
├── docker-compose.yml   # Local development: postgres, redis, api, web, admin ek saath  [Step 8]
├── package.json   # Monorepo root package (workspaces, turbo scripts)
├── pnpm-workspace.yaml   # Monorepo workspaces: apps/* aur packages/*  [Step 8]
├── PROGRESS.md   # Kya ho gaya aur kya baaki hai
├── README.md   # Project intro, setup aur run karne ke commands
├── STRUCTURE.md   # Ye file: poora folder structure aur kaun si file kahan banani hai
├── TASKS.md   # Step-by-step task checklist with Phase 1/Phase 2 (agent isi order me kaam kare)
└── turbo.json   # Turborepo pipeline: shared packages pehle build ho (dependsOn ^build), caching  [Step 8]
```
