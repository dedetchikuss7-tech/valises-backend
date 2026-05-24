#!/usr/bin/env bash
# Test JWT Expiré — Valises Backend
# Génère un JWT expiré et vérifie que l'API retourne 401.
#
# Usage: JWT_SECRET=your-secret BASE_URL=https://your-app.railway.app bash scripts/test-expired-jwt.sh
#
# Prérequis : node + jsonwebtoken disponibles.
# Si node n'est pas disponible, voir la section "Procédure manuelle" ci-dessous.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
JWT_SECRET="${JWT_SECRET:-change-me-in-prod}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "────────────────────────────────────────"
echo "Test JWT Expiré"
echo "BASE_URL : $BASE_URL"
echo "────────────────────────────────────────"
echo ""

# ── Vérification node ──
if ! command -v node &>/dev/null; then
  echo -e "${YELLOW}[WARN]${NC} node non disponible."
  echo ""
  echo "=== Procédure manuelle ==="
  echo "1. Installer node : https://nodejs.org"
  echo "2. npm install -g jsonwebtoken (ou utiliser npx)"
  echo "3. Générer un token expiré :"
  echo ""
  echo "   node -e \""
  echo "     const jwt = require('jsonwebtoken');"
  echo "     const token = jwt.sign({ sub: 'test-user', role: 'USER' }, '$JWT_SECRET', { expiresIn: '-1s' });"
  echo "     console.log(token);"
  echo "   \""
  echo ""
  echo "4. Tester : curl -H 'Authorization: Bearer <TOKEN>' $BASE_URL/transactions"
  echo "   Résultat attendu : HTTP 401"
  echo "=========================="
  exit 1
fi

# ── Vérification jsonwebtoken ──
if ! node -e "require('jsonwebtoken')" 2>/dev/null; then
  echo "→ jsonwebtoken non installé globalement — installation locale temporaire..."
  if [ -f "node_modules/jsonwebtoken/index.js" ]; then
    echo "   (trouvé dans node_modules/)"
  else
    echo -e "${YELLOW}[WARN]${NC} jsonwebtoken introuvable."
    echo ""
    echo "Installez-le : npm install jsonwebtoken"
    echo "Puis relancez ce script depuis la racine du projet."
    exit 1
  fi
fi

# ── Génération du JWT expiré ──
echo "→ Génération d'un JWT expiré (exp dans le passé)..."

EXPIRED_TOKEN=$(node -e "
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET || 'change-me-in-prod';
const token = jwt.sign(
  { sub: 'expired-test-user-id', role: 'USER', iat: Math.floor(Date.now() / 1000) - 7200 },
  secret,
  { expiresIn: '-1s' }
);
console.log(token);
" 2>/dev/null)

if [ -z "$EXPIRED_TOKEN" ]; then
  echo -e "${RED}[FAIL]${NC} Impossible de générer le token expiré"
  exit 1
fi

echo "  Token (tronqué) : ${EXPIRED_TOKEN:0:60}..."
echo ""

# ── Envoi de la requête ──
echo "→ GET $BASE_URL/transactions avec JWT expiré..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $EXPIRED_TOKEN" \
  "$BASE_URL/transactions")

echo "  Status reçu : $STATUS"
echo ""

# ── Évaluation ──
echo "────────────────────────────────────────"
if [ "$STATUS" = "401" ]; then
  echo -e "${GREEN}[PASS]${NC} JWT expiré correctement rejeté (401)"
  exit 0
elif [ "$STATUS" = "200" ]; then
  echo -e "${RED}[FAIL]${NC} JWT expiré ACCEPTÉ (200) — la vérification d'expiration est défaillante"
  exit 1
elif [ "$STATUS" = "403" ]; then
  echo -e "${RED}[FAIL]${NC} Reçu 403 au lieu de 401 — token reconnu mais accès refusé (vérifier le guard)"
  exit 1
else
  echo -e "${RED}[FAIL]${NC} Status inattendu : $STATUS (expected 401)"
  exit 1
fi
