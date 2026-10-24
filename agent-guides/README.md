# agent-guides

Reference links for the AI agent and for you. Do not copy third-party repos into this project; install or read them from the source. Check each repo's license before copying anything.

## Start here
`task-guide.md` is the task-wise guide: for every task it says which files to create, which skills to load, which references to read, the steps, and how to know it is done.

## How the agent learns in this project
- `CLAUDE.md` and `AGENTS.md` (root): always-read rules.
- `.claude/skills/*/SKILL.md`: on-demand procedures (payments, inventory, compliance, security, admin, UI quality, conventions, common mistakes).
- `STRUCTURE.md`: where every file goes.
- `agent-guides/mistakes-log.md`: add every mistake here, then turn it into a rule in the matching skill.

## Skills and agent resources
- Claude Code skills (format, `.claude/skills/<name>/SKILL.md`, frontmatter): https://code.claude.com/docs/en/skills
- Anthropic public skills repo (example skills, including frontend design): https://github.com/anthropics/skills
- Vercel agent skills (react-best-practices, composition-patterns, web-design-guidelines and more): https://github.com/vercel-labs/agent-skills

## Framework and library docs
- Next.js route handlers and middleware: https://nextjs.org/docs/app/getting-started/route-handlers-and-middleware
- Prisma transactions: https://docs.prisma.io/docs/orm/prisma-client/queries/transactions
- BullMQ: https://docs.bullmq.io/ (repeatable jobs: https://docs.bullmq.io/guide/jobs/repeatable)
- Zod: https://zod.dev
- Cloudflare R2 presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/

## Standards
- OWASP ASVS (web app security requirements): https://github.com/OWASP/ASVS
- WCAG 2.2 (accessibility): https://www.w3.org/TR/2023/REC-WCAG22-20231005/

## Payments and shipping
- Razorpay webhooks FAQ (retries, event id, raw-body signature): https://razorpay.com/docs/webhooks/faqs/
- Razorpay QR Codes create API (single-use fixed-amount UPI QR, expiry): https://razorpay.com/docs/api/qr-codes/create/
- Shiprocket API help (token validity 240 hours): https://support.shiprocket.in/support/solutions/articles/43000337456

## Not yet linked (find the official docs when needed)
Playwright, Turborepo, Tailwind, TanStack Table, shadcn/ui, Express. Search the official site; do not trust random blogs for API details.
