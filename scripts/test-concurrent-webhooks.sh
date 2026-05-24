#!/usr/bin/env bash
# Test Concurrent Webhook Delivery — Valises Backend
# Envoie 5 requêtes webhook en parallèle et vérifie qu'aucune ne retourne 500.
#
# Usage: BASE_URL=https://your-app.railway.app bash scripts/test-concurrent-webhooks.sh
#
# Seuil d'acceptabilité : 0 réponse 500 sur 5 requêtes concurrentes.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
CONCURRENCY=5

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

TMPDIR_RESULTS=$(mktemp -d)
trap 'rm -rf "$TMPDIR_RESULTS"' EXIT

echo "────────────────────────────────────────"
echo "Concurrent Webhook Delivery Test"
echo "BASE_URL    : $BASE_URL"
echo "Concurrence : $CONCURRENCY requêtes en parallèle"
echo "────────────────────────────────────────"
echo ""

TS=$(date +%s)

send_webhook() {
  local idx=$1
  local delivery_id="concurrent-delivery-${TS}-${idx}"
  local idempotency_key="smoke:concurrent:${TS}:${idx}"

  local payload
  payload=$(cat <<EOF
{
  "provider": "MOCK_STRIPE",
  "objectType": "PAYOUT",
  "eventType": "payout.processing",
  "idempotencyKey": "$idempotency_key",
  "externalReference": "test_concurrent_ref_${TS}_${idx}"
}
EOF
)

  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/provider-webhooks/events" \
    -H "Content-Type: application/json" \
    -H "x-provider-delivery-id: $delivery_id" \
    -d "$payload")

  echo "$status" > "$TMPDIR_RESULTS/result_${idx}"
  echo "  [worker $idx] delivery-id=$delivery_id → HTTP $status"
}

echo "→ Lancement de $CONCURRENCY requêtes en parallèle..."
echo ""

for i in $(seq 1 $CONCURRENCY); do
  send_webhook "$i" &
done

wait
echo ""

# ── Collecte des résultats ──
FAIL_500=0
TOTAL_OK=0

echo "────────────────────────────────────────"
echo "Résultats :"
for i in $(seq 1 $CONCURRENCY); do
  STATUS=$(cat "$TMPDIR_RESULTS/result_${i}")
  if [ "$STATUS" = "500" ]; then
    FAIL_500=$((FAIL_500 + 1))
    echo -e "  [worker $i] ${RED}$STATUS — ERREUR SERVEUR${NC}"
  elif [ "$STATUS" = "200" ] || [ "$STATUS" = "400" ] || [ "$STATUS" = "422" ] || [ "$STATUS" = "404" ] || [ "$STATUS" = "401" ]; then
    TOTAL_OK=$((TOTAL_OK + 1))
    echo -e "  [worker $i] ${GREEN}$STATUS — OK (attendu)${NC}"
  else
    echo "  [worker $i] $STATUS — inattendu (non 500, non bloquant)"
    TOTAL_OK=$((TOTAL_OK + 1))
  fi
done

echo ""
echo "────────────────────────────────────────"
if [ "$FAIL_500" = "0" ]; then
  echo -e "${GREEN}[PASS]${NC} 0 réponse 500 sur $CONCURRENCY requêtes concurrentes ($TOTAL_OK/$CONCURRENCY OK)"
  exit 0
else
  echo -e "${RED}[FAIL]${NC} $FAIL_500 réponse(s) 500 détectée(s) — le serveur a planté sous concurrence légère"
  exit 1
fi
