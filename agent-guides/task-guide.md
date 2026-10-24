# task-guide (task-wise)

Follow tasks in this order. For each task: create the files named in `STRUCTURE.md`, load the listed skills, read the listed references, do the steps, check "done when". Update `PROGRESS.md` after each task. Docs first: write or update the matching doc in `docs/` before the code.

Skill names mean `.claude/skills/<name>/SKILL.md`. Reference links are in `agent-guides/README.md`.

## T1. Project setup
- Files: root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`, `docker-compose.yml`, `.env.example`, `packages/*`
- Skills: monorepo-conventions, agent-common-mistakes
- Steps: init pnpm workspace; add Turborepo with `build` depending on `^build`; docker-compose for Postgres and Redis; env validation in `apps/api/src/config/env.ts`; shared lint and tsconfig in `packages/config`.
- Done when: `pnpm install` and `pnpm build` succeed from a clean clone, and `docker compose up` starts Postgres and Redis.

## T2. Database
- Files: `database/prisma/schema.prisma`, `database/sql/constraints.sql`, `database/seeds/seed.ts`
- Skills: inventory-concurrency, ecommerce-payments
- Docs first: `docs/04-data` (ERD, data dictionary, payment state machine, stock rules)
- Steps: model users, addresses, categories, products, variants, carts, orders, order items, payment attempts, webhook events (unique event id), idempotency keys, consents, audit logs, invoices, settings. All money fields integer paise. Add CHECK stock >= 0 in `constraints.sql`.
- Done when: migration runs on an empty DB, seed creates an admin and sample catalog, constraints reject negative stock.

## T3. Authentication (API + storefront pages)
- Files: `apps/api/src/modules/auth/*`, `users/*`, `middlewares/auth|rate-limit`, `apps/web/src/app/(auth)/*`
- Skills: security-baseline
- Reference: OWASP ASVS, Zod
- Steps: register with consent checkbox, login, logout, refresh token rotation, email verify, forgot/reset password, OTP if used, rate limits, httpOnly cookies. Shared schemas in `packages/validation`.
- Done when: tests cover wrong password, expired token, refresh reuse (rejected), rate-limit trigger.

## T4. Admin foundation
- Files: `apps/admin/src/app/login|staff|audit-logs`, `apps/api/src/modules/audit-logs/*`, `middlewares/role.middleware.ts`
- Skills: admin-panel, security-baseline
- Steps: follow "Build order" step 1 in the admin-panel skill.
- Done when: each role sees only allowed pages, API rejects wrong roles, every staff change is in the audit log.

## T5. Catalog: categories, products, uploads
- Files: `modules/categories|products|uploads`, `integrations/storage`, `apps/admin/src/app/products|categories`, `apps/web/src/app/(shop)/products|category|search`
- Skills: admin-panel, storefront-quality, security-baseline
- Reference: Cloudflare R2 presigned URLs, Next.js docs
- Steps: API for CRUD with variants; presigned upload URLs (content-type and size limits); admin screens; storefront listing with filters, product page with size guide and pincode check; basic search inside products module.
- Done when: owner adds a product with 3 images from the admin and it appears on the storefront, images never pass through the API server.

## T6. Inventory
- Files: `modules/inventory/*`, `jobs/schedulers/release-expired-stock.scheduler.ts`, `tests/integration/inventory-concurrency.test.ts`
- Skills: inventory-concurrency
- Reference: Prisma transactions, BullMQ repeatable jobs
- Steps: atomic decrement, reservation with expiry, release scheduler, admin adjustment with reason.
- Done when: the 100-parallel-orders test passes (exactly 1 wins for 1 item).

## T7. Cart
- Files: `modules/cart/*`, `apps/web/src/app/(shop)/cart`, `components/cart`, `store/`
- Skills: inventory-concurrency, storefront-quality
- Steps: add/update/remove, guest cart merged on login, server recomputes prices and availability.
- Done when: changing a price in the DB changes the cart total; client-sent prices are ignored.

## T8. Checkout and orders
- Files: `modules/orders|addresses|shipping`, `middlewares/idempotency.middleware.ts`, `apps/web/src/app/(shop)/checkout`
- Skills: ecommerce-payments, inventory-concurrency, storefront-quality
- Steps: address step, shipping charge and pincode check, create order with `Idempotency-Key`, reserve stock, create payment attempt.
- Done when: double-clicking "Place order" creates exactly one order.

## T9. Payments (UPI QR per order)
- Files: `modules/payments/*`, `integrations/razorpay/qr.client.ts`, `webhooks/razorpay.webhook.ts`, `jobs/schedulers/expire-qr|reconcile-payments`, `components/checkout/QrPayment.tsx`, `hooks/usePaymentStatus.ts`
- Skills: ecommerce-payments, security-baseline
- Reference: Razorpay webhooks FAQ, Razorpay QR Codes API
- Docs first: `docs/03-architecture/payment-flow.md`, ADR-0010, `docs/06-api/payment-status-api.md`
- Steps: provider adapter; one single-use fixed-amount QR per attempt; webhook with raw body, signature, event-id dedupe, fast 2xx, queue; status endpoint; polling UI with paid/failed/expired; expire and reconcile schedulers; manual-refund queue for odd payments. Verify the payment-received event name in the webhook docs.
- Done when: tests pass for duplicate webhook, wrong signature, 40 parallel same-amount payments, expired QR, missed webhook recovered by reconcile.

## T10. Shipping
- Files: `modules/shipping/*`, `integrations/shiprocket`, `webhooks/shiprocket.webhook.ts`
- Reference: Shiprocket API help
- Steps: pincode serviceability, create shipment after paid order, cache auth token in Redis (240h validity, refresh early), tracking updates by webhook.
- Done when: a paid order creates one shipment and tracking status shows on the order page.

## T11. Invoices (GST)
- Files: `modules/invoices/*`, `docs/04-data/gst-and-tax-model.md`
- Skills: india-compliance
- Steps: sequential invoice numbers, HSN, CGST+SGST or IGST by place of supply, PDF, rates and GSTIN from settings. Tell the owner to confirm tax details with a CA.
- Done when: invoice PDF is generated for a paid order and numbers have no gaps.

## T12. Notifications and queues
- Files: `modules/notifications/*`, `jobs/queues|workers|schedulers`, `apps/api/src/worker.ts`, `integrations/email|sms|whatsapp`
- Reference: BullMQ docs
- Steps: all sending goes through queues with retries; order confirmation, shipped, refund emails; abandoned-cart scheduler.
- Done when: stopping the email provider does not slow or fail checkout, and failed jobs retry.

## T13. Consent and privacy
- Files: `modules/consents/*`, `apps/web/src/app/account/privacy`, `apps/web/src/content/policies/*`, `components/common/CookieConsent`
- Skills: india-compliance
- Steps: consent log, data download, account deletion with anonymization (invoices kept), original policy pages.
- Done when: a deleted user's personal fields are anonymized and their invoices still exist.

## T14. Admin: orders, customers, settings, reports
- Files: `apps/admin/src/app/orders|customers|inventory|settings|dashboard`
- Skills: admin-panel
- Steps: build order steps 4 to 7 in the admin-panel skill.
- Done when: role tests pass and refunds only work through the payments module.

## T15. Storefront polish and SEO
- Files: `apps/web/src/app/*`, `components/*`, `sitemap.ts`, `robots.ts`
- Skills: storefront-quality
- Reference: WCAG 2.2, Vercel agent skills (react-best-practices, web-design-guidelines)
- Done when: Lighthouse accessibility and SEO checks pass, keyboard-only checkout works, phone layout checked.

## T16. Testing
- Files: `tests/*`, `*.test.ts` next to each module, `docs/08-testing/*`
- Steps: unit tests per module, integration tests for stock, payments and webhooks, end-to-end test for signup -> cart -> checkout -> paid, security checks from the security-baseline skill.
- Done when: CI runs all tests and the end-to-end purchase passes.

## T17. CI/CD and deploy
- Files: `.github/workflows/*`, `infra/*`, `docs/09-devops`, `docs/10-deployment`
- Steps: CI with turbo lint, test, build; dependency and secret scanning; staging then production; backups and a restore test; monitoring and error tracking; rollback plan.
- Done when: a push to main deploys to staging, and a restore from backup has been tested once.

## T18. Phase 2 modules
- Modules: wishlist, coupons, reviews, banners, search, cms, analytics
- Steps: one module at a time with the same 5-file pattern, doc first, tests, admin screen if needed. Coupons must be applied on the server and re-validated at payment time.
