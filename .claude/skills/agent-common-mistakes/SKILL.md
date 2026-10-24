---
name: agent-common-mistakes
description: Use on every task in this project. Lists the mistakes AI coding agents commonly make and must avoid.
---

# Mistakes to avoid

1. Inventing packages, functions or API fields. Check that a package exists and read its current docs. Versions in your memory may be old (Next.js, Prisma, Razorpay).
2. Saying "done" without running it. Run build, lint and the relevant tests, and open the page, before reporting completion.
3. Silent stubs. Never leave fake success paths (for example a payment mock that always says paid) in real code. Mark TODOs clearly and list them in `PROGRESS.md`.
4. Committing secrets or real keys. Use `.env` and `.env.example` only.
5. Floats for money, trusting client prices, marking paid from a redirect. See `ecommerce-payments`.
6. Read-then-write stock updates. See `inventory-concurrency`.
7. Rewriting unrelated files or reformatting the whole repo. Change only what the task needs.
8. Changing folder structure or tech stack without a `DECISIONS.md` entry.
9. Swallowing errors (empty catch), or logging personal data and tokens.
10. Copying another website's logo, text, images or layout details.
11. Guessing when a requirement is unclear and hard to undo. Ask first. When it is easy to redo, pick the reasonable option and say which one you picked.
12. Ignoring empty, loading and error states in the UI.
13. Skipping tests for payments, stock and auth, which are the high-risk parts.
14. Automating logins or bots on third-party sites to get around their systems.
