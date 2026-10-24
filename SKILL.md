---
name: admin-panel
description: Use when building or changing the admin app (apps/admin) or any admin API endpoint, including staff roles, products, orders, inventory, refunds, settings and audit logs.
---

# Admin panel

## Architecture
- Admin is its own app, `apps/admin`, deployed on its own subdomain. Never put admin pages inside `apps/web`.
- Admin API lives under `/api/v1/admin/*`, protected by `auth.middleware.ts` and `role.middleware.ts`. Every endpoint declares which roles may use it.
- Roles (configurable, start with): owner (everything), manager (catalog, orders, inventory, coupons), support (view orders and customers, update order notes). Check permissions on the server for every request.
- Login with email + password, 2FA recommended, short session, logout on inactivity.

## Audit log (mandatory)
Every create, update, delete, refund, stock change, role change and settings change writes to `audit-logs`: who, what, entity id, before/after values, time, IP. Audit entries are append-only; nobody can edit them.

## Build order
1. Foundation: login, role middleware, staff page, audit log page, layout and navigation.
2. Catalog: categories, products with variants (size/color/SKU/price in paise), image upload through presigned URLs, publish/unpublish.
3. Inventory: stock view, adjustments with a required reason (written to the audit log).
4. Orders: list with server-side filters, detail page, status changes, refunds, invoice download, order notes.
5. Customers: list and detail; mask phone and email for support role; no bulk personal-data export without owner role and an audit entry.
6. Settings: store details, GSTIN and tax config, shipping rules, payment toggles.
7. Dashboard and reports (reads only, aggregated queries, never N+1).

## Safety rules
- Never hard-delete products, orders or customers. Archive or soft-delete.
- Order status changes follow the state machine on the server (placed -> confirmed -> packed -> shipped -> delivered; cancelled; returned; refunded). Reject illegal jumps.
- Refunds go only through the `payments` module, never by editing a payment row.
- Money in paise. Show rupees only in the UI.
- Destructive actions (cancel order, refund, unpublish, role change) need a confirmation dialog that states the effect.
- All tables use server-side pagination, search, filter and sort. Every table has loading, empty and error states.
- CSV exports are limited, role-checked and logged.
- Reuse shared zod schemas from `packages/validation` for forms and API.

## Done when
A staff member with each role can do exactly what the role allows and nothing more, every change appears in the audit log, and the same action by the wrong role is rejected by the API (not just hidden in the UI).
