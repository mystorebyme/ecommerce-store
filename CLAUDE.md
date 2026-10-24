# CLAUDE.md

Read `AGENTS.md` and `STRUCTURE.md` first. They define the rules, the folder tree, build phases and the critical engineering rules.

Then open `agent-guides/task-guide.md`, find the task you are doing, and follow its steps. Each task lists the files, the skills to load, the references and a "done when" check.

Project skills live in `.claude/skills/`. Use them:
- Anything about money, QR, webhooks, refunds -> `ecommerce-payments`
- Stock, cart, checkout -> `inventory-concurrency`
- GST, invoices, consent, account deletion -> `india-compliance`
- Auth, tokens, uploads -> `security-baseline`
- Admin app (apps/admin) or admin API -> `admin-panel`
- Any UI work -> `storefront-quality`
- Creating files/modules -> `monorepo-conventions`
- Always -> `agent-common-mistakes`

When you make a mistake or get corrected, add a line to `agent-guides/mistakes-log.md`.
