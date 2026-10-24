---
name: monorepo-conventions
description: Use when creating files, folders, backend modules, shared packages or changing project structure.
---

# Monorepo conventions

- `STRUCTURE.md` is the source of truth for where files go. Do not change the structure without a note in `DECISIONS.md`.
- Docs first: the doc in `docs/` is written or updated before the code it describes.
- Backend module = 5 files in `apps/api/src/modules/<name>/`: `.routes`, `.controller`, `.service`, `.schema`, `.test`. Routes only wire, controllers only handle request/response, services hold business logic.
- Shared validation lives in `packages/validation`; shared types in `packages/types`. Module `.schema.ts` holds only API-only extras.
- `apps/*` may import from `packages/*`. `apps/*` never import from each other.
- Keep `turbo.json` build order: shared packages build first (`dependsOn: ["^build"]`).
- Build Phase 1 modules first (marked [P1] in `STRUCTURE.md`).
- Small, focused commits. After each task update `PROGRESS.md`.
