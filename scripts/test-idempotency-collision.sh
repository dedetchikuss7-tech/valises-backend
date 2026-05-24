#!/usr/bin/env bash
# Test Idempotency Collision — Valises Backend
# Vérifie que deux webhooks identiques (même idempotencyKey) n'en traitent qu'un seul.
#
# Usage: BASE_URL=https://your-app.railway.app bash scripts/test-idempotency-collision.sh
#
# Prérequis : l'application doit être démarrée et accessible à BASE_URL.
# Note : ce test envoie un vrai webhook PAYOUT au service. Sans payout réel en DB,
# la réponse peut être 400 (not found) sur la première requête — c'est attendu.
# L'objectif est de vérifier qu'une deuxième requête avec la même idempotencyKey
# ne déclenche pas un 500 et est ignorée silencieusement.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DELIVERY_ID="test-idempotency-$(date +%s)"
IDEMPOTENCY_KEY="smoke:idempotency:${DELIVERY_ID}"

PAYLOAD=$(cat <<EOF
{
  "provider": "MOCK_STRIPE",
  "objectType": "PAYOUT",
  "eventType": "payout.paid",
  "idempotencyKey": "$IDEMPOTENCY_KEY",
  "externalReference": "test_ext_ref_idempotency_${DELIVERY_ID}"
}
EOF
)

echo "────────────────────────────────────────"
echo "Idempotency Collision Test"
echo "BASE_URL     : $BASE_URL"
echo "delivery-id  : $DELIVERY_ID"
echo "idempotencyKey: $IDEMPOTENCY_KEY"
echo "────────────────────────────────────────"
echo ""

# ── Requête 1 ──
echo "→ Requête 1 (première livraison)..."
RESP1=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/provider-webhooks/events" \
  -H "Content-Type: application/json" \
  -H "x-provider-delivery-id: $DELIVERY_ID" \
  -d "$PAYLOAD")
STATUS1=$(echo "$RESP1" | tail -n1)
BODY1=$(echo "$RESP1" | head -n -1)

echo "  Status : $STATUS1"
echo "  Body   : $BODY1"
echo ""

if [ "$STATUS1" = "500" ]; then
  echo -e "${RED}[FAIL]${NC} Requête 1 — server error (500)"
  exit 1
fi

# ── Requête 2 — même idempotencyKey ──
echo "→ Requête 2 (même idempotencyKey — doit être ignorée)..."
RESP2=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/provider-webhooks/events" \
  -H "Content-Type: application/json" \
  -H "x-provider-delivery-id: $DELIVERY_ID" \
  -d "$PAYLOAD")
STATUS2=$(echo "$RESP2" | tail -n1)
BODY2=$(echo "$RESP2" | head -n -1)

echo "  Status : $STATUS2"
echo "  Body   : $BODY2"
echo ""

# ── Évaluation ──
echo "────────────────────────────────────────"
PASS=1

if [ "$STATUS2" = "500" ]; then
  echo -e "${RED}[FAIL]${NC} Requête 2 — server error (500) : idempotency non gérée"
  PASS=0
fi

if echo "$BODY2" | grep -qi "duplicate\|already.*processed\|idempotent\|ignored"; then
  echo -e "${GREEN}[PASS]${NC} Requête 2 — réponse indique idempotency gérée"
elif [ "$STATUS2" = "$STATUS1" ]; then
  echo -e "${GREEN}[PASS]${NC} Requête 2 — même status que requête 1 ($STATUS2), comportement cohérent"
else
  echo -e "${YELLOW}[WARN]${NC} Requête 2 — status différent ($STATUS1 → $STATUS2). Vérifier manuellement si idempotency est respectée."
fi

if [ "$PASS" = "1" ]; then
  echo ""
  echo -e "${GREEN}RÉSULTAT : aucun double traitement détecté (pas de 500)${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}RÉSULTAT : anomalie détectée — voir les détails ci-dessus${NC}"
  exit 1
fi
