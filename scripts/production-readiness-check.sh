#!/usr/bin/env bash
# Production Readiness Check — Valises Backend
# Usage: BASE_URL=https://your-app.railway.app bash scripts/production-readiness-check.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
PASS=0
FAIL=0
TOTAL=10

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

pass() {
  PASS=$((PASS + 1))
  echo -e "${GREEN}[PASS]${NC} $1"
}

fail() {
  FAIL=$((FAIL + 1))
  echo -e "${RED}[FAIL]${NC} $1"
}

# ──────────────────────────────────────────────
# CHECK 1 — Liveness probe
# GET /ops/healthz → expect 200
# ──────────────────────────────────────────────
echo ""
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/ops/healthz")
if [ "$STATUS" = "200" ]; then
  pass "CHECK 1 — Liveness probe (200)"
else
  fail "CHECK 1 — Liveness probe (got $STATUS, expected 200)"
fi

# ──────────────────────────────────────────────
# CHECK 2 — Readiness probe (avec DB)
# GET /ops/readyz → expect 200 + body contains "ok":true
# ──────────────────────────────────────────────
BODY=$(curl -s "$BASE_URL/ops/readyz")
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/ops/readyz")
if [ "$STATUS" = "200" ] && echo "$BODY" | grep -q '"ok":true\|"status":"ready"\|"status":"ok"'; then
  pass "CHECK 2 — Readiness probe + DB check (200, body ok)"
else
  fail "CHECK 2 — Readiness probe (got $STATUS, body: $BODY)"
fi

# ──────────────────────────────────────────────
# CHECK 3 — Auth register smoke test
# POST /auth/register avec email unique (timestamp) → expect 201
# ──────────────────────────────────────────────
TS=$(date +%s)
TEST_EMAIL="smoke-${TS}@test-readiness.local"
TEST_PASSWORD="SmokePass1234!"

BODY=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"role\":\"USER\"}")
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TS}b@test-readiness.local\",\"password\":\"$TEST_PASSWORD\",\"role\":\"USER\"}")
if [ "$STATUS" = "201" ]; then
  pass "CHECK 3 — Auth register smoke test (201)"
else
  fail "CHECK 3 — Auth register (got $STATUS, expected 201)"
fi

# ──────────────────────────────────────────────
# CHECK 4 — Auth login smoke test
# POST /auth/login avec les credentials du check 3 → expect 200 + JWT
# ──────────────────────────────────────────────
LOGIN_BODY=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_BODY" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4 || true)
if [ "$LOGIN_STATUS" = "200" ] && [ -n "$TOKEN" ]; then
  pass "CHECK 4 — Auth login smoke test (200, JWT received)"
else
  fail "CHECK 4 — Auth login (got $LOGIN_STATUS, body: $LOGIN_BODY)"
  TOKEN=""
fi

# ──────────────────────────────────────────────
# CHECK 5 — Endpoint protégé sans token → 401
# GET /transactions sans Authorization → expect 401
# ──────────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/transactions")
if [ "$STATUS" = "401" ]; then
  pass "CHECK 5 — Protected endpoint without token (401)"
else
  fail "CHECK 5 — Protected endpoint without token (got $STATUS, expected 401)"
fi

# ──────────────────────────────────────────────
# CHECK 6 — Endpoint protégé avec token valide → 200
# GET /transactions avec Bearer → expect 200
# ──────────────────────────────────────────────
if [ -n "$TOKEN" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "$BASE_URL/transactions")
  if [ "$STATUS" = "200" ]; then
    pass "CHECK 6 — Protected endpoint with valid token (200)"
  else
    fail "CHECK 6 — Protected endpoint with token (got $STATUS, expected 200)"
  fi
else
  fail "CHECK 6 — Protected endpoint with token (SKIPPED: no token from check 4)"
fi

# ──────────────────────────────────────────────
# CHECK 7 — Webhook endpoint public accessible
# POST /provider-webhooks/events avec body vide → expect 400 ou 422 (pas 404, pas 500)
# ──────────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/provider-webhooks/events" \
  -H "Content-Type: application/json" \
  -d '{}')
if [ "$STATUS" = "400" ] || [ "$STATUS" = "422" ]; then
  pass "CHECK 7 — Webhook endpoint public accessible ($STATUS, not 404/500)"
elif [ "$STATUS" = "404" ]; then
  fail "CHECK 7 — Webhook endpoint public (got 404 — route not registered)"
elif [ "$STATUS" = "500" ]; then
  fail "CHECK 7 — Webhook endpoint public (got 500 — server error on empty body)"
else
  fail "CHECK 7 — Webhook endpoint public (got $STATUS, expected 400 or 422)"
fi

# ──────────────────────────────────────────────
# CHECK 8 — Swagger désactivé en prod
# GET /docs → expect 404 (SWAGGER_ENABLED=false)
# ──────────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/docs")
if [ "$STATUS" = "404" ]; then
  pass "CHECK 8 — Swagger désactivé en prod (404)"
elif [ "$STATUS" = "200" ]; then
  fail "CHECK 8 — Swagger désactivé (got 200 — SWAGGER_ENABLED is probably true, disable it in prod)"
else
  fail "CHECK 8 — Swagger (got $STATUS, expected 404)"
fi

# ──────────────────────────────────────────────
# CHECK 9 — Health endpoint public
# GET /health → expect 200
# ──────────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
if [ "$STATUS" = "200" ]; then
  pass "CHECK 9 — Health endpoint public (200)"
else
  fail "CHECK 9 — Health endpoint (got $STATUS, expected 200)"
fi

# ──────────────────────────────────────────────
# CHECK 10 — Rate limiting actif sur auth
# 15 requêtes POST /auth/login en rafale → au moins une doit retourner 429
# ──────────────────────────────────────────────
echo ""
echo "Running CHECK 10 — rate limit burst (15 requests)..."
GOT_429=0
for i in $(seq 1 15); do
  S=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"ratelimit-probe@test-readiness.local","password":"Wrong1234!"}')
  if [ "$S" = "429" ]; then
    GOT_429=1
    break
  fi
done

if [ "$GOT_429" = "1" ]; then
  pass "CHECK 10 — Rate limiting actif sur auth (429 received)"
else
  fail "CHECK 10 — Rate limiting (no 429 after 15 rapid requests — throttler may be disabled)"
fi

# ──────────────────────────────────────────────
# SUMMARY
# ──────────────────────────────────────────────
echo ""
echo "────────────────────────────────────────"
if [ "$FAIL" = "0" ]; then
  echo -e "${GREEN}SUMMARY: $PASS/$TOTAL checks passed${NC}"
else
  echo -e "${RED}SUMMARY: $PASS/$TOTAL checks passed ($FAIL failed)${NC}"
fi
echo "────────────────────────────────────────"

exit $FAIL
