#!/usr/bin/env bash
set -euo pipefail

PASS=0
FAIL=0
WARNINGS=0

print_ok()   { echo "  [OK]   $1"; PASS=$((PASS+1)); }
print_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }
print_warn() { echo "  [WARN] $1"; WARNINGS=$((WARNINGS+1)); }

echo ""
echo "================================================"
echo "  Valises — Pre-launch Check"
echo "================================================"
echo ""

# ── 1. Required env vars ──────────────────────────────────────────────────────
echo "[ 1/7 ] Environment variables"

check_env() {
  if [ -z "${!1:-}" ]; then
    print_fail "Missing: $1"
  else
    print_ok "$1 is set"
  fi
}

check_env "DATABASE_URL"
check_env "JWT_SECRET"
check_env "CINETPAY_API_KEY"
check_env "CINETPAY_SITE_ID"
check_env "AWS_ACCESS_KEY_ID"
check_env "AWS_SECRET_ACCESS_KEY"
check_env "AWS_S3_BUCKET"
check_env "AWS_REGION"
check_env "SENDGRID_API_KEY"
check_env "PAYMENT_PROVIDER"
check_env "STORAGE_PROVIDER"

# ── 2. Database connectivity + migrations ─────────────────────────────────────
echo ""
echo "[ 2/7 ] Database"

if npx prisma migrate status 2>&1 | grep -q "Database schema is up to date"; then
  print_ok "All migrations applied"
else
  print_warn "Pending migrations detected — run: npx prisma migrate deploy"
fi

# ── 3. PSP connectivity ───────────────────────────────────────────────────────
echo ""
echo "[ 3/7 ] PSP (CinetPay)"

if [ "${PAYMENT_PROVIDER:-}" = "CINETPAY" ]; then
  CINETPAY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 5 \
    "https://api-checkout.cinetpay.com/v2/payment" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"apikey":"'"${CINETPAY_API_KEY:-}"'","site_id":"'"${CINETPAY_SITE_ID:-}"'"}' \
    2>/dev/null || echo "000")
  if [ "$CINETPAY_STATUS" != "000" ]; then
    print_ok "CinetPay API reachable (HTTP $CINETPAY_STATUS)"
  else
    print_fail "CinetPay API unreachable"
  fi
else
  print_warn "PAYMENT_PROVIDER is not CINETPAY — skipping PSP check (current: ${PAYMENT_PROVIDER:-unset})"
fi

# ── 4. S3 connectivity ────────────────────────────────────────────────────────
echo ""
echo "[ 4/7 ] S3 Storage"

if [ "${STORAGE_PROVIDER:-}" = "S3" ]; then
  if aws s3 ls "s3://${AWS_S3_BUCKET:-}" --region "${AWS_REGION:-us-east-1}" \
       --max-items 1 > /dev/null 2>&1; then
    print_ok "S3 bucket accessible: ${AWS_S3_BUCKET:-}"
  else
    print_fail "S3 bucket not accessible — check credentials and bucket name"
  fi
else
  print_warn "STORAGE_PROVIDER is not S3 — skipping S3 check (current: ${STORAGE_PROVIDER:-unset})"
fi

# ── 5. SendGrid ───────────────────────────────────────────────────────────────
echo ""
echo "[ 5/7 ] SendGrid"

if [ -n "${SENDGRID_API_KEY:-}" ]; then
  SG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 5 \
    -H "Authorization: Bearer ${SENDGRID_API_KEY}" \
    "https://api.sendgrid.com/v3/scopes" \
    2>/dev/null || echo "000")
  if [ "$SG_STATUS" = "200" ]; then
    print_ok "SendGrid API key valid"
  else
    print_fail "SendGrid API key invalid or unreachable (HTTP $SG_STATUS)"
  fi
else
  print_warn "SENDGRID_API_KEY not set — email sending will be unavailable"
fi

# ── 6. Seed data ──────────────────────────────────────────────────────────────
echo ""
echo "[ 6/7 ] Seed data"

CORRIDOR_COUNT=$(npx prisma db execute --stdin <<'SQL' 2>/dev/null | tail -1 || echo "0"
SELECT COUNT(*)::text FROM "Corridor";
SQL
)

if [ "${CORRIDOR_COUNT:-0}" -gt "0" ] 2>/dev/null; then
  print_ok "Corridors seeded ($CORRIDOR_COUNT found)"
else
  print_warn "No corridors found — run: npx prisma db seed"
fi

# ── 7. Admin user ─────────────────────────────────────────────────────────────
echo ""
echo "[ 7/7 ] Admin user"

ADMIN_COUNT=$(npx prisma db execute --stdin <<'SQL' 2>/dev/null | tail -1 || echo "0"
SELECT COUNT(*)::text FROM "User" WHERE role = 'ADMIN';
SQL
)

if [ "${ADMIN_COUNT:-0}" -gt "0" ] 2>/dev/null; then
  print_ok "Admin user exists ($ADMIN_COUNT admin(s) found)"
else
  print_fail "No admin user found — create one before launch"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "================================================"
echo "  Results: $PASS passed, $FAIL failed, $WARNINGS warnings"
echo "================================================"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "  Status: NOT READY — fix $FAIL failing check(s) before launch"
  echo ""
  exit 1
else
  echo "  Status: READY — all required checks passed"
  echo ""
  exit 0
fi
