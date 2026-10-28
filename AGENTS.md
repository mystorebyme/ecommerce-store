# AGENTS.md

## Project
E-commerce clothing store (India). Reference sites se sirf feature aur layout style ka idea lena hai.

## Rules
- Pehle `STRUCTURE.md` padho (tree, phases aur 14 critical engineering rules). Har file wahin banao jahan wahan likha hai.
- Reference sites ka logo, brand name, product photos, text copy use NAHI karna. Apni branding banao.
- Pehle `docs/` me document, phir code. Kaam `TASKS.md` ke order me.
- Development me pehle Phase 1 modules, Phase 2 launch ke baad.
- Har task ke baad `PROGRESS.md` update karo. Bade decision `DECISIONS.md` aur `docs/03-architecture/adr` me likho.
- Secrets sirf `.env` me, kabhi code me nahi.
- `.claude/skills/` ki skills padho, khaaskar `agent-common-mistakes`. Galti ho to `agent-guides/mistakes-log.md` me likho.
- Folder structure bina `DECISIONS.md` me likhe mat badlo.

## Critical rules (short)
Paisa integer paise me | server price decide kare | stock atomic decrement | self-hosted UPI gateway: ek VPA par ek ACTIVE slot, observer webhook raw body + HMAC + UTR dedupe |
payment sirf server se confirm | order idempotent | uploads presigned | queues BullMQ | validation `packages/validation` me.
Poori list `STRUCTURE.md` me.

## Tech stack
Next.js + TypeScript + Tailwind, Node.js + Express, PostgreSQL + Prisma, Redis + BullMQ, pnpm + Turborepo, S3/R2,
self-hosted UPI gateway (koi payment aggregator nahi — `apps/api/src/modules/gateway`), Shiprocket.
Final decision `docs/03-architecture/adr` me.

## Coding standards
(Architecture step ke baad bharna hai.)
