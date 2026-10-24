---
name: security-baseline
description: Use when writing authentication, sessions, roles, admin features, file uploads, API endpoints or configuration.
---

# Security baseline

Reference standard: OWASP ASVS (github.com/OWASP/ASVS).

- Passwords hashed with argon2id (or bcrypt with a high cost). Never store or log plain passwords.
- Short-lived access token, refresh token with rotation and reuse detection, stored in httpOnly + Secure + SameSite cookies.
- Rate-limit login, OTP, password reset and checkout endpoints.
- Authorization is checked on the server for every request (RBAC in `role.middleware.ts`). Hiding a button in the UI is not security.
- Validate every input with the shared zod schemas from `packages/validation`. Use Prisma / parameterized queries only; no string-built SQL.
- Uploads: presigned URLs with content-type and size limits, files served from a separate storage domain, no executable types.
- CORS allowlist, security headers (helmet), no wildcard origins with credentials.
- Admin app on its own subdomain, 2FA recommended, every admin action written to `audit-logs`.
- Secrets only in environment variables. Validate env at startup (`config/env.ts`). Never commit `.env`.
- Error responses never leak stack traces or internal ids.
- Run dependency audit in CI (`security.yml`).
