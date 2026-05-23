#!/usr/bin/env bash
# validate-mobile-endpoints.sh
# Validates the 20 MVP endpoints against the Valises backend.
#
# Usage:
#   bash scripts/validate-mobile-endpoints.sh
#
# Env vars:
#   BASE_URL         Target backend (default: production)
#   TEST_EMAIL       Reuse a registered user (optional — creates fresh user if unset)
#   TEST_PASSWORD    Password for TEST_EMAIL (required if TEST_EMAIL is set)
#   ACTIVE_TRIP_ID   UUID of an ACTIVE trip (ticket VERIFIED by admin) for transaction tests.
#                    Set this to achieve ≥ 18/20.  Without it, endpoints 13/15/16/18 will ❌.
#
# Score target: ≥ 18/20
# Deps: curl, jq

set -uo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL="${BASE_URL:-https://valises-backend-production.up.railway.app}"
TS=$(date +%s 2>/dev/null || echo "000")
TEST_EMAIL="${TEST_EMAIL:-mvp-test-${TS}@valises-validate.com}"
TEST_PASSWORD="${TEST_PASSWORD:-Validate@123!}"
ACTIVE_TRIP_ID="${ACTIVE_TRIP_ID:-}"

# ── Colours ───────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
else
  GREEN=''; RED=''; YELLOW=''; NC=''
fi

# ── State ─────────────────────────────────────────────────────────────────────
PASS=0; FAIL=0
TOKEN=""
CORRIDOR_ID=""
TRIP_ID=""
PKG_ID=""
TX_ID=""

# ── Helpers ───────────────────────────────────────────────────────────────────
check_deps() {
  local missing=()
  command -v curl &>/dev/null || missing+=("curl")
  command -v jq   &>/dev/null || missing+=("jq")
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo -e "${RED}❌ Missing deps: ${missing[*]}${NC}"
    echo "   Install jq: https://jqlang.github.io/jq/download/"
    exit 1
  fi
}

http() {
  # http METHOD URL [extra curl args...]
  local method="$1" url="$2"; shift 2
  curl -s -w "\n%{http_code}" --max-time 15 -X "$method" "$url" "$@"
}

body()   { printf '%s' "$1" | head -n -1; }
status() { printf '%s' "$1" | tail -1; }

pass_ep() { printf "${GREEN}✅ [%02d] %-55s → %s${NC}\n" "$1" "$2" "$3"; ((PASS++)) || true; }
fail_ep() { printf "${RED}❌ [%02d] %-55s → %s (exp %s)${NC}\n" "$1" "$2" "$3" "$4"; ((FAIL++)) || true; }

jq_str()      { echo "$1" | jq -r "$2" 2>/dev/null || true; }
jq_bool_ok()  { [[ "$(echo "$1" | jq -r "$2" 2>/dev/null)" == "true" ]]; }

# ── Checks ────────────────────────────────────────────────────────────────────
check_deps
echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "  Valises MVP Endpoint Validation"
printf "  Base URL : %s\n" "$BASE_URL"
printf "  User     : %s\n" "$TEST_EMAIL"
[[ -n "$ACTIVE_TRIP_ID" ]] && printf "  Trip ID  : %s\n" "$ACTIVE_TRIP_ID" || \
  printf "${YELLOW}  ACTIVE_TRIP_ID not set — endpoints 13/15/16/18 may fail${NC}\n"
echo "══════════════════════════════════════════════════════════════════════"
echo ""

# ── 01  POST /auth/register ───────────────────────────────────────────────────
R=$(http POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
S=$(status "$R")
if [[ "$S" == "201" ]]; then
  pass_ep 1 "POST /auth/register" "$S"
else
  # 409 = email already exists → still proceed, login will work
  fail_ep 1 "POST /auth/register" "$S" "201"
fi

# ── 02  POST /auth/login ──────────────────────────────────────────────────────
R=$(http POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
S=$(status "$R"); B=$(body "$R")
TOKEN=$(jq_str "$B" '.accessToken')
if [[ "$S" == "200" && -n "$TOKEN" && "$TOKEN" != "null" ]]; then
  pass_ep 2 "POST /auth/login (+accessToken)" "$S"
else
  fail_ep 2 "POST /auth/login (+accessToken)" "status=$S token=${TOKEN:-missing}" "200+token"
  echo -e "${RED}  Cannot continue without JWT. Aborting.${NC}"
  echo ""
  echo "  SCORE: $PASS / $((PASS + FAIL))"
  exit 1
fi

AUTH=(-H "Authorization: Bearer $TOKEN")

# ── 03  GET /onboarding/status ────────────────────────────────────────────────
R=$(http GET "$BASE_URL/onboarding/status" "${AUTH[@]}")
S=$(status "$R")
[[ "$S" == "200" ]] && pass_ep 3 "GET /onboarding/status" "$S" || fail_ep 3 "GET /onboarding/status" "$S" "200"

# ── 04  GET /mobile/me/contract ───────────────────────────────────────────────
R=$(http GET "$BASE_URL/mobile/me/contract" "${AUTH[@]}")
S=$(status "$R"); B=$(body "$R")
HAS_CORRIDORS=$(jq_str "$B" '.corridors | length')
HAS_PAYIN=$(jq_str "$B" '.supportedPayinMethods | length')
PLATFORM_VER=$(jq_str "$B" '.platformVersion')
if [[ "$S" == "200" && "${HAS_CORRIDORS:-0}" -gt 0 && "${HAS_PAYIN:-0}" -gt 0 && -n "$PLATFORM_VER" ]]; then
  pass_ep 4 "GET /mobile/me/contract (+corridors,payinMethods,ver)" "$S"
  CORRIDOR_ID=$(jq_str "$B" '.corridors[0].id')
else
  fail_ep 4 "GET /mobile/me/contract" "$S" "200+corridors+payinMethods+platformVersion"
fi

# ── 05  GET /pricing/corridors ────────────────────────────────────────────────
R=$(http GET "$BASE_URL/pricing/corridors" "${AUTH[@]}")
S=$(status "$R"); B=$(body "$R")
HAS_ITEMS=$(jq_str "$B" '.items | length')
if [[ "$S" == "200" && "${HAS_ITEMS:-0}" -gt 0 ]]; then
  pass_ep 5 "GET /pricing/corridors (+items[])" "$S"
else
  fail_ep 5 "GET /pricing/corridors" "$S" "200+items[]"
fi

# ── 06  GET /kyc/me ───────────────────────────────────────────────────────────
R=$(http GET "$BASE_URL/kyc/me" "${AUTH[@]}")
S=$(status "$R")
[[ "$S" == "200" ]] && pass_ep 6 "GET /kyc/me" "$S" || fail_ep 6 "GET /kyc/me" "$S" "200"

# ── 07  POST /trips ───────────────────────────────────────────────────────────
if [[ -z "$CORRIDOR_ID" || "$CORRIDOR_ID" == "null" ]]; then
  fail_ep 7 "POST /trips" "SKIP (no corridorId from step 04)" "201"
else
  DEPART_AT=$(date -u -d '60 days' '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || \
              date -u -v+60d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || \
              echo "2027-06-01T10:00:00Z")
  R=$(http POST "$BASE_URL/trips" "${AUTH[@]}" \
    -H "Content-Type: application/json" \
    -d "{\"corridorId\":\"$CORRIDOR_ID\",\"departAt\":\"$DEPART_AT\",\"capacityKg\":23}")
  S=$(status "$R"); B=$(body "$R")
  TRIP_ID=$(jq_str "$B" '.id')
  [[ "$S" == "201" ]] && pass_ep 7 "POST /trips" "$S" || fail_ep 7 "POST /trips" "$S" "201"
fi

# ── 08  GET /trips/me ─────────────────────────────────────────────────────────
R=$(http GET "$BASE_URL/trips/me" "${AUTH[@]}")
S=$(status "$R")
[[ "$S" == "200" ]] && pass_ep 8 "GET /trips/me" "$S" || fail_ep 8 "GET /trips/me" "$S" "200"

# ── 09  POST /packages ────────────────────────────────────────────────────────
if [[ -z "$CORRIDOR_ID" || "$CORRIDOR_ID" == "null" ]]; then
  fail_ep 9 "POST /packages" "SKIP (no corridorId)" "201"
else
  R=$(http POST "$BASE_URL/packages" "${AUTH[@]}" \
    -H "Content-Type: application/json" \
    -d "{\"corridorId\":\"$CORRIDOR_ID\",\"weightKg\":5,\"description\":\"MVP validation package\"}")
  S=$(status "$R"); B=$(body "$R")
  PKG_ID=$(jq_str "$B" '.id')
  [[ "$S" == "201" ]] && pass_ep 9 "POST /packages" "$S" || fail_ep 9 "POST /packages" "$S" "201"
fi

# ── 10  PATCH /packages/:id/declare-content ───────────────────────────────────
if [[ -z "$PKG_ID" || "$PKG_ID" == "null" ]]; then
  fail_ep 10 "PATCH /packages/:id/declare-content" "SKIP (no package)" "200"
else
  CONTENT_BODY='{"contentCategory":"CLOTHING","contentSummary":"Validation test items","declaredItemCount":3,"declaredValueAmount":50,"declaredValueCurrency":"EUR","containsFragileItems":false,"containsLiquid":false,"containsElectronic":false,"containsBattery":false,"containsMedicine":false,"containsPerishableItems":false,"containsValuableItems":false,"containsDocuments":false,"containsProhibitedItems":false,"prohibitedItemsDeclarationAccepted":true}'
  R=$(http PATCH "$BASE_URL/packages/$PKG_ID/declare-content" "${AUTH[@]}" \
    -H "Content-Type: application/json" -d "$CONTENT_BODY")
  S=$(status "$R")
  [[ "$S" == "200" ]] && pass_ep 10 "PATCH /packages/:id/declare-content" "$S" || fail_ep 10 "PATCH /packages/:id/declare-content" "$S" "200"
fi

# ── 11  PATCH /packages/:id/publish ──────────────────────────────────────────
if [[ -z "$PKG_ID" || "$PKG_ID" == "null" ]]; then
  fail_ep 11 "PATCH /packages/:id/publish" "SKIP (no package)" "200"
else
  R=$(http PATCH "$BASE_URL/packages/$PKG_ID/publish" "${AUTH[@]}")
  S=$(status "$R")
  [[ "$S" == "200" ]] && pass_ep 11 "PATCH /packages/:id/publish" "$S" || fail_ep 11 "PATCH /packages/:id/publish" "$S" "200"
fi

# ── 12  GET /matching/packages/:id/trip-candidates ────────────────────────────
if [[ -z "$PKG_ID" || "$PKG_ID" == "null" ]]; then
  fail_ep 12 "GET /matching/packages/:id/trip-candidates" "SKIP (no package)" "200"
else
  R=$(http GET "$BASE_URL/matching/packages/$PKG_ID/trip-candidates" "${AUTH[@]}")
  S=$(status "$R")
  [[ "$S" == "200" ]] && pass_ep 12 "GET /matching/packages/:id/trip-candidates" "$S" || fail_ep 12 "GET /matching/packages/:id/trip-candidates" "$S" "200"
fi

# ── 13  POST /transactions ────────────────────────────────────────────────────
# Requires: trip ACTIVE (ticket VERIFIED by admin). Set ACTIVE_TRIP_ID to enable.
TX_TRIP="${ACTIVE_TRIP_ID:-$TRIP_ID}"
if [[ -z "$PKG_ID" || "$PKG_ID" == "null" || -z "$TX_TRIP" || "$TX_TRIP" == "null" ]]; then
  fail_ep 13 "POST /transactions" "SKIP (no package/trip)" "201"
else
  R=$(http POST "$BASE_URL/transactions" "${AUTH[@]}" \
    -H "Content-Type: application/json" \
    -d "{\"tripId\":\"$TX_TRIP\",\"packageId\":\"$PKG_ID\"}")
  S=$(status "$R"); B=$(body "$R")
  TX_ID=$(jq_str "$B" '.transaction.id')
  [[ "$S" == "201" ]] && pass_ep 13 "POST /transactions" "$S" || fail_ep 13 "POST /transactions" "$S" "201"
fi

# ── 14  GET /transactions ─────────────────────────────────────────────────────
R=$(http GET "$BASE_URL/transactions" "${AUTH[@]}")
S=$(status "$R")
[[ "$S" == "200" ]] && pass_ep 14 "GET /transactions" "$S" || fail_ep 14 "GET /transactions" "$S" "200"

# ── 15  GET /transactions/:id ─────────────────────────────────────────────────
if [[ -z "$TX_ID" || "$TX_ID" == "null" ]]; then
  fail_ep 15 "GET /transactions/:id" "SKIP — set ACTIVE_TRIP_ID" "200"
else
  R=$(http GET "$BASE_URL/transactions/$TX_ID" "${AUTH[@]}")
  S=$(status "$R")
  [[ "$S" == "200" ]] && pass_ep 15 "GET /transactions/:id" "$S" || fail_ep 15 "GET /transactions/:id" "$S" "200"
fi

# ── 16  POST /transactions/:id/payment-intent ────────────────────────────────
if [[ -z "$TX_ID" || "$TX_ID" == "null" ]]; then
  fail_ep 16 "POST /transactions/:id/payment-intent" "SKIP — set ACTIVE_TRIP_ID" "201"
else
  R=$(http POST "$BASE_URL/transactions/$TX_ID/payment-intent" "${AUTH[@]}" \
    -H "Content-Type: application/json" -d '{}')
  S=$(status "$R")
  [[ "$S" == "201" ]] && pass_ep 16 "POST /transactions/:id/payment-intent" "$S" || fail_ep 16 "POST /transactions/:id/payment-intent" "$S" "201"
fi

# ── 17  POST /legal/packages/:id/acknowledge-rules ───────────────────────────
if [[ -z "$PKG_ID" || "$PKG_ID" == "null" ]]; then
  fail_ep 17 "POST /legal/packages/:id/acknowledge-rules" "SKIP (no package)" "201"
else
  R=$(http POST "$BASE_URL/legal/packages/$PKG_ID/acknowledge-rules" "${AUTH[@]}")
  S=$(status "$R")
  [[ "$S" == "201" ]] && pass_ep 17 "POST /legal/packages/:id/acknowledge-rules" "$S" || fail_ep 17 "POST /legal/packages/:id/acknowledge-rules" "$S" "201"
fi

# ── 18  POST /legal/transactions/:id/acknowledge-platform-role ────────────────
if [[ -z "$TX_ID" || "$TX_ID" == "null" ]]; then
  fail_ep 18 "POST /legal/transactions/:id/acknowledge-platform-role" "SKIP — set ACTIVE_TRIP_ID" "201"
else
  R=$(http POST "$BASE_URL/legal/transactions/$TX_ID/acknowledge-platform-role" "${AUTH[@]}")
  S=$(status "$R")
  [[ "$S" == "201" ]] && pass_ep 18 "POST /legal/transactions/:id/acknowledge-platform-role" "$S" || fail_ep 18 "POST /legal/transactions/:id/acknowledge-platform-role" "$S" "201"
fi

# ── 19  GET /notifications/me ─────────────────────────────────────────────────
# Note: POST /notifications/me does not exist — the correct verb is GET
R=$(http GET "$BASE_URL/notifications/me" "${AUTH[@]}")
S=$(status "$R")
[[ "$S" == "200" ]] && pass_ep 19 "GET /notifications/me" "$S" || fail_ep 19 "GET /notifications/me" "$S" "200"

# ── 20  GET /activity-feed/me ─────────────────────────────────────────────────
R=$(http GET "$BASE_URL/activity-feed/me" "${AUTH[@]}")
S=$(status "$R")
[[ "$S" == "200" ]] && pass_ep 20 "GET /activity-feed/me" "$S" || fail_ep 20 "GET /activity-feed/me" "$S" "200"

# ── FINAL SCORE ───────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL))
echo ""
echo "══════════════════════════════════════════════════════════════════════"
printf "  SCORE: %d/%d\n" "$PASS" "$TOTAL"
if [[ $PASS -ge 18 ]]; then
  printf "${GREEN}  ✅ Target ≥18/20 reached!${NC}\n"
else
  printf "${RED}  ❌ Target ≥18/20 not reached${NC}\n"
  if [[ -z "$ACTIVE_TRIP_ID" ]]; then
    echo ""
    echo "  To reach 18/20, set ACTIVE_TRIP_ID to an ACTIVE trip UUID."
    echo "  An admin must first: create trip → submit-ticket → verify-ticket → publish."
    echo "  Then: ACTIVE_TRIP_ID=<uuid> bash scripts/validate-mobile-endpoints.sh"
  fi
fi
echo "══════════════════════════════════════════════════════════════════════"
echo ""

[[ $PASS -ge 18 ]] && exit 0 || exit 1
