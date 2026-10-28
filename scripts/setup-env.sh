#!/usr/bin/env bash
# Purpose: Ek command me local gateway setup — `.env` banao (secrets generate karke),
#          VPA set karo, aur kya-kya baaki hai wo print karo.
#
# Usage:
#   ./scripts/setup-env.sh --vpa 7073448140@ptsbi --name "Your Store"
#   ./scripts/setup-env.sh --vpa store@okhdfcbank --webhook-url https://api.example.com/api/youpi/webhook
#
# Rules:
#   * Secrets sirf `apps/api/.env` me jaate hain (gitignored) — repo me kabhi nahi.
#   * Script idempotent hai: dobara chalane par purane secrets/VPA preserve hote hain.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/apps/api/.env"
VPA=""
NAME=""
PAYEE=""
WEBHOOK_URL=""
PAY_WINDOW="300"
VERIFY_WINDOW="30"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --vpa) VPA="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --payee) PAYEE="$2"; shift 2 ;;
    --webhook-url) WEBHOOK_URL="$2"; shift 2 ;;
    --pay-window) PAY_WINDOW="$2"; shift 2 ;;
    --verify-window) VERIFY_WINDOW="$2"; shift 2 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# --- helpers ---------------------------------------------------------------
read_env() { # read_env KEY
  [[ -f "$ENV_FILE" ]] || return 0
  awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
}
random_secret() { openssl rand -hex 24 2>/dev/null || node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))'; }
upsert() { # upsert KEY VALUE
  local key="$1" value="$2"
  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    # macOS/BSD sed compatible in-place edit
    local tmp; tmp="$(mktemp)"
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k {print k "=" v; next} {print}' "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

# --- defaults / validation -------------------------------------------------
[[ -n "$NAME" ]] || NAME="$(read_env MERCHANT_NAME)" || true
[[ -n "$NAME" ]] || NAME="Demo Store"
[[ -n "$PAYEE" ]] || PAYEE="$(read_env PAYEE_NAME)" || true
[[ -n "$PAYEE" ]] || PAYEE="$NAME"

if [[ -z "$VPA" ]]; then
  VPA="$(read_env MERCHANT_VPA)" || true
fi
if [[ -z "$VPA" ]]; then
  echo "❌ --vpa chahiye (e.g. --vpa 9876543210@ptsbi) — QR isi VPA par banega." >&2
  exit 1
fi
if ! [[ "$VPA" =~ ^[A-Za-z0-9._-]{2,64}@[A-Za-z]{2,32}$ ]]; then
  echo "❌ VPA format galat: $VPA (chahiye: name@bank, e.g. 9876543210@ptsbi)" >&2
  exit 1
fi

mkdir -p "$ROOT/apps/api"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

# --- values: purane preserve karo, khaali ho to generate -------------------
OBSERVER_SECRET="$(read_env OBSERVER_SHARED_SECRET)"; [[ -n "$OBSERVER_SECRET" ]] || OBSERVER_SECRET="$(random_secret)"
ADMIN_TOKEN="$(read_env ADMIN_API_TOKEN)";             [[ -n "$ADMIN_TOKEN" ]] || ADMIN_TOKEN="$(random_secret)"
WEBHOOK_SECRET="$(read_env MERCHANT_WEBHOOK_SECRET)"; [[ -n "$WEBHOOK_SECRET" ]] || WEBHOOK_SECRET="$(random_secret)"
[[ -n "$WEBHOOK_URL" ]] || WEBHOOK_URL="$(read_env MERCHANT_WEBHOOK_URL)" || true

upsert NODE_ENV development
upsert PORT 4000
upsert PUBLIC_WEB_URL "$(read_env PUBLIC_WEB_URL || echo http://localhost:3000)"
upsert PUBLIC_API_URL "$(read_env PUBLIC_API_URL || echo http://localhost:4000)"
upsert DATABASE_URL "$(read_env DATABASE_URL || echo postgres://youpi:youpi@localhost:5432/youpi)"
upsert REDIS_URL "$(read_env REDIS_URL || echo redis://localhost:6379)"

upsert MERCHANT_VPA "$VPA"
upsert MERCHANT_NAME "$NAME"
upsert PAYEE_NAME "$PAYEE"
upsert MERCHANT_WEBHOOK_URL "$WEBHOOK_URL"
upsert MERCHANT_WEBHOOK_SECRET "$WEBHOOK_SECRET"
upsert OBSERVER_SHARED_SECRET "$OBSERVER_SECRET"
upsert ADMIN_API_TOKEN "$ADMIN_TOKEN"
upsert PAY_WINDOW_SECONDS "$PAY_WINDOW"
upsert VERIFY_WINDOW_SECONDS "$VERIFY_WINDOW"

cat <<EOF

✅ apps/api/.env likh diya (gitignored, chmod 600)

   Merchant VPA : $VPA
   Payee name   : $PAYEE
   Pay window   : ${PAY_WINDOW}s   Verify window: ${VERIFY_WINDOW}s

   Secrets generate ho gaye (purane preserve kiye gaye):
     OBSERVER_SHARED_SECRET  → Android observer app me daalna hai
     ADMIN_API_TOKEN         → admin calls ke liye (x-admin-token)
     MERCHANT_WEBHOOK_SECRET → aapke server par HMAC verify ke liye

   Dekhne ke liye:
     grep -E 'MERCHANT_VPA|OBSERVER_SHARED_SECRET|ADMIN_API_TOKEN' apps/api/.env

Agle steps:
   1. docker compose up -d postgres
   2. npm install && npm run prisma:generate
   3. npx prisma migrate deploy --schema database/prisma/schema.prisma
   4. psql "\$DATABASE_URL" -f database/sql/constraints.sql
   5. npx tsx database/seeds/seed.ts
   6. npm run api:dev          → http://localhost:4000/api/v1/health
   7. npx tsx scripts/observer-simulator.ts flow
EOF
