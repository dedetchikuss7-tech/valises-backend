#!/usr/bin/env bash
# E2E MVP Test — Valises Backend
# Teste les 20 endpoints MVP dans l'ordre avec curl.
#
# Prérequis : jq, curl, node (avec @prisma/client + bcrypt dans node_modules)
# Usage     : bash scripts/e2e-mvp-test.sh [--base-url http://localhost:3000]
#
# Le script seed la DB (Corridor + CorridorPricingPaymentConfig + utilisateur admin)
# via un snippet Node.js inline avant d'exécuter les appels HTTP.

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
BASE_URL="${BASE_URL:-http://localhost:3000}"
CORRIDOR_CODE="FR_CM"
TS=$(date +%s)
SENDER_EMAIL="sender-${TS}@e2e.test"
SENDER_PASS="SenderE2E123!"
TRAVELER_EMAIL="traveler-${TS}@e2e.test"
TRAVELER_PASS="TravelerE2E123!"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin-e2e@valises.test}"
ADMIN_PASS="${ADMIN_PASS:-AdminE2E123!}"
# Date de départ : dans 60 jours (ISO 8601 UTC)
DEPART_AT="2027-06-15T10:00:00.000Z"

# ─── Couleurs ─────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
fail() { echo -e "${RED}  ❌ $1${NC}"; exit 1; }
step() { echo -e "\n${BOLD}${CYAN}━━━ ÉTAPE $1: $2${NC}"; }
info() { echo -e "   ${YELLOW}→${NC} $1"; }

# ─── Parsing des arguments ────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url) BASE_URL="$2"; shift 2 ;;
    *) echo "Usage: $0 [--base-url URL]"; exit 1 ;;
  esac
done

# ─── Vérification des dépendances ─────────────────────────────────────────────
command -v jq   >/dev/null 2>&1 || fail "jq requis. Installez: apt install jq  /  brew install jq"
command -v curl >/dev/null 2>&1 || fail "curl requis."
command -v node >/dev/null 2>&1 || fail "node requis."

echo ""
echo -e "${BOLD}══════════════════════════════════════════════${NC}"
echo -e "${BOLD} 🧳  Valises Backend — E2E MVP Test${NC}"
echo -e "${BOLD}══════════════════════════════════════════════${NC}"
echo -e "  URL      : ${BASE_URL}"
echo -e "  Corridor : ${CORRIDOR_CODE}"
echo -e "  Date     : $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ─── Helper HTTP ──────────────────────────────────────────────────────────────
# Usage: http <METHOD> <PATH> <TOKEN|-> [BODY_JSON]
# Retourne: corps JSON + marqueur __STATUS__NNN en fin de sortie
http() {
  local method="$1"
  local path="$2"
  local token="$3"
  local body="${4:-}"
  local url="${BASE_URL}${path}"

  if [[ "$token" == "-" ]]; then
    if [[ -n "$body" ]]; then
      curl -s -w "\n__STATUS__%{http_code}" -X "$method" "$url" \
        -H "Content-Type: application/json" \
        -d "$body"
    else
      curl -s -w "\n__STATUS__%{http_code}" -X "$method" "$url"
    fi
  else
    if [[ -n "$body" ]]; then
      curl -s -w "\n__STATUS__%{http_code}" -X "$method" "$url" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${token}" \
        -d "$body"
    else
      curl -s -w "\n__STATUS__%{http_code}" -X "$method" "$url" \
        -H "Authorization: Bearer ${token}"
    fi
  fi
}

# Extrait le corps (tout sauf le dernier marqueur __STATUS__)
body_of()   { printf '%s' "$1" | sed 's/__STATUS__[0-9]*$//'; }
# Extrait le code HTTP
status_of() { printf '%s' "$1" | grep -o '__STATUS__[0-9]*$' | sed 's/__STATUS__//'; }

# Vérifie le statut HTTP, affiche ✅ ou ❌ et arrête en cas d'erreur
assert_status() {
  local label="$1"
  local response="$2"
  local expected="${3:-200}"
  local actual
  actual=$(status_of "$response")
  local body
  body=$(body_of "$response")

  if [[ "$actual" == "$expected" ]]; then
    ok "${label} (HTTP ${actual})"
  else
    echo -e "${RED}  ❌ ${label} — attendu HTTP ${expected}, obtenu HTTP ${actual}${NC}"
    echo -e "${RED}     Réponse: $(echo "$body" | jq -c '.' 2>/dev/null || echo "$body")${NC}"
    exit 1
  fi
}

# ─── SETUP: Seed de la base via Node.js inline ────────────────────────────────
echo -e "${BOLD}${YELLOW}━━━ SETUP: Initialisation de la base de données ━━━${NC}"
info "Corridor ${CORRIDOR_CODE} + CorridorPricingPaymentConfig + compte admin..."

SETUP_OUTPUT=$(ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASS="$ADMIN_PASS" node - <<'NODEJS'
const bcrypt  = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma  = new PrismaClient();

async function main() {
  // 1. Corridor FR_CM
  const corridor = await prisma.corridor.upsert({
    where:  { code: 'FR_CM' },
    update: {},
    create: { code: 'FR_CM', name: 'France → Cameroun', status: 'ACTIVE' },
  });

  // 2. CorridorPricingPaymentConfig — valeurs terrain observées (seed officiel)
  await prisma.corridorPricingPaymentConfig.upsert({
    where:  { corridorCode: 'FR_CM' },
    update: {},
    create: {
      corridorCode:            'FR_CM',
      originCountryCode:       'FR',
      destinationCountryCode:  'CM',
      status:                  'SOCLE',
      pricingSourceType:       'OBSERVED',
      pricingCalibrationBasis: 'Observed terrain anchors — E2E seed',
      confidenceLevel:         'HIGH',
      isEstimated:             false,
      requiresManualReview:    false,
      isVisible:               true,
      isBookable:              true,
      isActive:                true,
      settlementCurrency:      'EUR',
      terrainPricePerKg:       10.0,
      terrainBundle23kg:       160.0,
      terrainBundle32kg:       null,
      travelerGainPerKg:       9.0,
      senderPricePerKg:        11.5,
      spreadPerKg:             2.5,
      travelerGainBundle23kg:  145.0,
      senderPriceBundle23kg:   185.0,
      spreadBundle23kg:        40.0,
      travelerGainBundle32kg:  170.0,
      senderPriceBundle32kg:   210.0,
      spreadBundle32kg:        40.0,
      payinMethodsAllowed:     ['CARD', 'BANK_TRANSFER'],
      payoutMethodsAllowed:    ['MOBILE_MONEY', 'BANK_PAYOUT', 'MANUAL_PAYOUT'],
      payinPrimaryRail:        'STRIPE',
      payinBackupRail:         'BANK',
      payoutPrimaryRail:       'CINETPAY',
      payoutBackupRail:        'BANK',
      fallbackRail:            'MANUAL',
      notes:                   'Seeded by e2e-mvp-test.sh',
    },
  });

  // 3. Utilisateur admin (mot de passe mis à jour à chaque exécution)
  const adminEmail = process.env.ADMIN_EMAIL || 'admin-e2e@valises.test';
  const adminPass  = process.env.ADMIN_PASS  || 'AdminE2E123!';
  const hash       = await bcrypt.hash(adminPass, 10);

  const admin = await prisma.user.upsert({
    where:  { email: adminEmail },
    update: { password: hash },
    create: {
      email:     adminEmail,
      password:  hash,
      role:      'ADMIN',
      kycStatus: 'VERIFIED',
    },
  });

  process.stdout.write(JSON.stringify({
    corridorId: corridor.id,
    adminId:    admin.id,
  }) + '\n');
}

main()
  .catch(err => {
    process.stderr.write('SETUP_ERROR: ' + err.message + '\n');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
NODEJS
) || fail "Setup DB échoué — vérifiez DATABASE_URL et que la base de données est accessible"

CORRIDOR_ID=$(echo "$SETUP_OUTPUT" | tail -1 | jq -r '.corridorId')
[[ -z "$CORRIDOR_ID" || "$CORRIDOR_ID" == "null" ]] \
  && fail "corridorId manquant dans le résultat du setup"

ok "Corridor ${CORRIDOR_CODE} prêt (id: ${CORRIDOR_ID})"
ok "CorridorPricingPaymentConfig prêt (senderPricePerKg=11.5 EUR/kg)"
ok "Admin prêt (${ADMIN_EMAIL})"

# ════════════════════════════════════════════════════════════════════════════════
#  AUTH
# ════════════════════════════════════════════════════════════════════════════════

# ─── ÉTAPE 1: Inscription expéditeur ──────────────────────────────────────────
step "1" "POST /auth/register — Créer le compte expéditeur (sender)"
RESP=$(http POST /auth/register - \
  "{\"email\":\"${SENDER_EMAIL}\",\"password\":\"${SENDER_PASS}\"}")
assert_status "Inscription sender" "$RESP" "201"
info "Email: ${SENDER_EMAIL}"

# ─── ÉTAPE 2: Inscription voyageur ────────────────────────────────────────────
step "2" "POST /auth/register — Créer le compte voyageur (traveler)"
RESP=$(http POST /auth/register - \
  "{\"email\":\"${TRAVELER_EMAIL}\",\"password\":\"${TRAVELER_PASS}\"}")
assert_status "Inscription traveler" "$RESP" "201"
info "Email: ${TRAVELER_EMAIL}"

# ─── ÉTAPE 3: Login sender ────────────────────────────────────────────────────
step "3" "POST /auth/login — Token JWT sender"
RESP=$(http POST /auth/login - \
  "{\"email\":\"${SENDER_EMAIL}\",\"password\":\"${SENDER_PASS}\"}")
assert_status "Login sender" "$RESP" "200"
BODY=$(body_of "$RESP")
TOKEN_SENDER=$(echo "$BODY" | jq -r '.accessToken')
SENDER_ID=$(echo "$BODY"    | jq -r '.user.id')
[[ -z "$TOKEN_SENDER" || "$TOKEN_SENDER" == "null" ]] && fail "accessToken sender manquant"
info "Sender ID: ${SENDER_ID}"

# ─── ÉTAPE 4: Login traveler ──────────────────────────────────────────────────
step "4" "POST /auth/login — Token JWT traveler"
RESP=$(http POST /auth/login - \
  "{\"email\":\"${TRAVELER_EMAIL}\",\"password\":\"${TRAVELER_PASS}\"}")
assert_status "Login traveler" "$RESP" "200"
BODY=$(body_of "$RESP")
TOKEN_TRAVELER=$(echo "$BODY" | jq -r '.accessToken')
TRAVELER_ID=$(echo "$BODY"    | jq -r '.user.id')
[[ -z "$TOKEN_TRAVELER" || "$TOKEN_TRAVELER" == "null" ]] && fail "accessToken traveler manquant"
info "Traveler ID: ${TRAVELER_ID}"

# ─── ÉTAPE 5: Login admin ─────────────────────────────────────────────────────
step "5" "POST /auth/login — Token JWT admin (vérifications et opérations admin)"
RESP=$(http POST /auth/login - \
  "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASS}\"}")
assert_status "Login admin" "$RESP" "200"
TOKEN_ADMIN=$(body_of "$RESP" | jq -r '.accessToken')
[[ -z "$TOKEN_ADMIN" || "$TOKEN_ADMIN" == "null" ]] && fail "accessToken admin manquant"
info "Admin authentifié"

# ════════════════════════════════════════════════════════════════════════════════
#  KYC
# ════════════════════════════════════════════════════════════════════════════════

# ─── ÉTAPE 6: KYC sender ──────────────────────────────────────────────────────
step "6" "GET /kyc/me — Statut KYC du sender"
RESP=$(http GET /kyc/me "$TOKEN_SENDER")
assert_status "KYC sender" "$RESP" "200"
KYC_SENDER=$(body_of "$RESP" | jq -r '.kycStatus')
info "kycStatus sender: ${KYC_SENDER}"

# ─── ÉTAPE 7: KYC traveler ────────────────────────────────────────────────────
step "7" "GET /kyc/me — Statut KYC du traveler"
RESP=$(http GET /kyc/me "$TOKEN_TRAVELER")
assert_status "KYC traveler" "$RESP" "200"
KYC_TRAVELER=$(body_of "$RESP" | jq -r '.kycStatus')
info "kycStatus traveler: ${KYC_TRAVELER}"

# Le paiement (étape 20) exige kycStatus=VERIFIED pour le traveler.
# Mise à jour admin → VERIFIED via PATCH /kyc/users/:id/status
info "Mise à jour KYC traveler → VERIFIED (requis pour la confirmation de paiement)..."
RESP_KYC=$(http PATCH "/kyc/users/${TRAVELER_ID}/status" "$TOKEN_ADMIN" \
  '{"kycStatus":"VERIFIED"}')
assert_status "KYC traveler VERIFIED (admin)" "$RESP_KYC" "200"
ok "Traveler KYC → VERIFIED"

# ════════════════════════════════════════════════════════════════════════════════
#  PRICING
# ════════════════════════════════════════════════════════════════════════════════

# ─── ÉTAPE 8: Listing des corridors ───────────────────────────────────────────
step "8" "GET /pricing/corridors — Lister les corridors disponibles"
RESP=$(http GET /pricing/corridors "$TOKEN_SENDER")
assert_status "Listing corridors" "$RESP" "200"
BODY=$(body_of "$RESP")
CORRIDOR_COUNT=$(echo "$BODY" | jq -r '.count')
info "Corridors disponibles: ${CORRIDOR_COUNT}"
CORRIDOR_BOOKABLE=$(echo "$BODY" | jq -r \
  --arg code "$CORRIDOR_CODE" \
  '.items[] | select(.corridorCode == $code) | .isBookable')
[[ "$CORRIDOR_BOOKABLE" == "true" ]] \
  && info "Corridor ${CORRIDOR_CODE}: isBookable=true ✓" \
  || info "Corridor ${CORRIDOR_CODE} non trouvé dans le listing (isVisible peut être false)"

# ════════════════════════════════════════════════════════════════════════════════
#  TRAJET (TRIP)
# ════════════════════════════════════════════════════════════════════════════════

# ─── ÉTAPE 9: Créer le trajet (DRAFT) ─────────────────────────────────────────
step "9" "POST /trips — Créer un trajet en brouillon (traveler)"
RESP=$(http POST /trips "$TOKEN_TRAVELER" \
  "{\"corridorId\":\"${CORRIDOR_ID}\",\"departAt\":\"${DEPART_AT}\",\"capacityKg\":23}")
assert_status "Création trajet" "$RESP" "201"
BODY=$(body_of "$RESP")
TRIP_ID=$(echo "$BODY"     | jq -r '.id')
TRIP_STATUS=$(echo "$BODY" | jq -r '.status')
[[ -z "$TRIP_ID" || "$TRIP_ID" == "null" ]] && fail "id trajet manquant"
info "Trip ID: ${TRIP_ID} | status: ${TRIP_STATUS} | departAt: ${DEPART_AT}"

# ─── ÉTAPE 10: Upload intent (billet de vol) ──────────────────────────────────
step "10" "POST /trips/:id/ticket-upload-intent — Préparer l'upload du billet"
RESP=$(http POST "/trips/${TRIP_ID}/ticket-upload-intent" "$TOKEN_TRAVELER" \
  '{"fileName":"billet-paris-douala.pdf","mimeType":"application/pdf","sizeBytes":512000}')
assert_status "Upload intent billet" "$RESP" "201"
BODY=$(body_of "$RESP")
STORAGE_KEY=$(echo "$BODY"      | jq -r '.storageKey')
STORAGE_PROVIDER=$(echo "$BODY" | jq -r '.provider')
[[ -z "$STORAGE_KEY" || "$STORAGE_KEY" == "null" ]] && fail "storageKey manquant"
info "Provider: ${STORAGE_PROVIDER}"
info "Storage key: ${STORAGE_KEY}"

# ─── ÉTAPE 11: Soumettre les métadonnées du billet ────────────────────────────
step "11" "PATCH /trips/:id/submit-ticket — Soumettre les métadonnées du billet"
RESP=$(http PATCH "/trips/${TRIP_ID}/submit-ticket" "$TOKEN_TRAVELER" \
  "{\"fileName\":\"billet-paris-douala.pdf\",\"mimeType\":\"application/pdf\",\
\"sizeBytes\":512000,\"provider\":\"${STORAGE_PROVIDER}\",\
\"storageKey\":\"${STORAGE_KEY}\",\"ticketRef\":\"AF-E2E${TS}\"}")
assert_status "Soumission billet" "$RESP" "200"
TICKET_STATUS=$(body_of "$RESP" | jq -r '.flightTicketStatus')
info "flightTicketStatus: ${TICKET_STATUS}"

# ─── ÉTAPE 12: Admin vérifie le billet ───────────────────────────────────────
step "12" "PATCH /admin/trips/:id/verify-ticket — Admin vérifie le billet de vol"
RESP=$(http PATCH "/admin/trips/${TRIP_ID}/verify-ticket" "$TOKEN_ADMIN" \
  '{"decision":"VERIFIED","reviewNotes":"Billet lisible et cohérent — vérification E2E."}')
assert_status "Vérification billet (admin)" "$RESP" "200"
TICKET_STATUS=$(body_of "$RESP" | jq -r '.flightTicketStatus')
[[ "$TICKET_STATUS" == "VERIFIED" ]] \
  && ok "flightTicketStatus = VERIFIED ✓" \
  || fail "flightTicketStatus attendu VERIFIED, obtenu: ${TICKET_STATUS}"

# ─── ÉTAPE 13: Publier le trajet ─────────────────────────────────────────────
step "13" "PATCH /trips/:id/publish — Publier le trajet"
RESP=$(http PATCH "/trips/${TRIP_ID}/publish" "$TOKEN_TRAVELER")
assert_status "Publication trajet" "$RESP" "200"
TRIP_STATUS=$(body_of "$RESP" | jq -r '.status')
[[ "$TRIP_STATUS" == "ACTIVE" ]] \
  && ok "Trajet ACTIVE ✓ (id: ${TRIP_ID})" \
  || fail "Trajet status attendu ACTIVE, obtenu: ${TRIP_STATUS}"

# ════════════════════════════════════════════════════════════════════════════════
#  COLIS (PACKAGE)
# ════════════════════════════════════════════════════════════════════════════════

# ─── ÉTAPE 14: Créer le colis (DRAFT) ────────────────────────────────────────
step "14" "POST /packages — Créer un colis en brouillon (sender)"
RESP=$(http POST /packages "$TOKEN_SENDER" \
  "{\"corridorId\":\"${CORRIDOR_ID}\",\"weightKg\":10,\
\"description\":\"Vêtements et effets personnels — E2E ${TS}\"}")
assert_status "Création colis" "$RESP" "201"
BODY=$(body_of "$RESP")
PACKAGE_ID=$(echo "$BODY"   | jq -r '.id')
PKG_STATUS=$(echo "$BODY"   | jq -r '.status')
[[ -z "$PACKAGE_ID" || "$PACKAGE_ID" == "null" ]] && fail "id colis manquant"
info "Package ID: ${PACKAGE_ID} | status: ${PKG_STATUS} | weightKg: 10"

# ─── ÉTAPE 15: Déclarer le contenu ───────────────────────────────────────────
step "15" "PATCH /packages/:id/declare-content — Déclarer le contenu du colis"
RESP=$(http PATCH "/packages/${PACKAGE_ID}/declare-content" "$TOKEN_SENDER" \
  '{"contentCategory":"CLOTHING","contentSummary":"Vêtements, chaussures et effets personnels",
"declaredItemCount":5,"declaredValueAmount":150,"declaredValueCurrency":"EUR",
"containsFragileItems":false,"containsLiquid":false,"containsElectronic":false,
"containsBattery":false,"containsMedicine":false,"containsPerishableItems":false,
"containsValuableItems":false,"containsDocuments":false,"containsProhibitedItems":false,
"prohibitedItemsDeclarationAccepted":true}')
assert_status "Déclaration contenu" "$RESP" "200"
COMPLIANCE=$(body_of "$RESP" | jq -r '.contentComplianceStatus')
info "contentComplianceStatus: ${COMPLIANCE}"
[[ "$COMPLIANCE" == "BLOCKED" ]] && fail "Contenu bloqué après déclaration (inattendu)"

# ─── ÉTAPE 16: Accepter les règles articles prohibés ─────────────────────────
step "16" "POST /legal/packages/:id/acknowledge-rules — Accepter les règles articles prohibés"
RESP=$(http POST "/legal/packages/${PACKAGE_ID}/acknowledge-rules" "$TOKEN_SENDER")
assert_status "Acceptation règles articles prohibés" "$RESP" "201"
info "PROHIBITED_ITEMS_NOTICE accepté pour le colis ${PACKAGE_ID}"

# ─── ÉTAPE 17: Publier le colis ──────────────────────────────────────────────
step "17" "PATCH /packages/:id/publish — Publier le colis"
RESP=$(http PATCH "/packages/${PACKAGE_ID}/publish" "$TOKEN_SENDER")
assert_status "Publication colis" "$RESP" "200"
PKG_STATUS=$(body_of "$RESP" | jq -r '.status')
[[ "$PKG_STATUS" == "PUBLISHED" ]] \
  && ok "Colis PUBLISHED ✓ (id: ${PACKAGE_ID})" \
  || fail "Colis status attendu PUBLISHED, obtenu: ${PKG_STATUS}"

# ════════════════════════════════════════════════════════════════════════════════
#  MATCHING
# ════════════════════════════════════════════════════════════════════════════════

# ─── ÉTAPE 18: Trouver les trajets candidats ──────────────────────────────────
step "18" "GET /matching/packages/:id/trip-candidates — Trouver les trajets compatibles"
RESP=$(http GET "/matching/packages/${PACKAGE_ID}/trip-candidates" "$TOKEN_SENDER")
assert_status "Trip candidates" "$RESP" "200"
BODY=$(body_of "$RESP")
CANDIDATE_COUNT=$(echo "$BODY" | jq 'length')
info "Candidats trouvés: ${CANDIDATE_COUNT}"
MATCHED=$(echo "$BODY" | jq -r --arg tid "$TRIP_ID" '.[] | select(.trip.id == $tid) | .trip.id')
[[ "$MATCHED" == "$TRIP_ID" ]] \
  && ok "Trajet ${TRIP_ID} présent dans les candidats ✓" \
  || info "⚠️  Trajet non trouvé dans les candidats (${CANDIDATE_COUNT} résultat(s))"

# ════════════════════════════════════════════════════════════════════════════════
#  TRANSACTION
# ════════════════════════════════════════════════════════════════════════════════

# ─── ÉTAPE 19: Créer la transaction ──────────────────────────────────────────
step "19" "POST /transactions — Créer la transaction (sender)"
RESP=$(http POST /transactions "$TOKEN_SENDER" \
  "{\"tripId\":\"${TRIP_ID}\",\"packageId\":\"${PACKAGE_ID}\"}")
assert_status "Création transaction" "$RESP" "201"
BODY=$(body_of "$RESP")
TX_ID=$(echo "$BODY"         | jq -r '.transaction.id')
TX_AMOUNT=$(echo "$BODY"     | jq -r '.transaction.amount')
TX_CURRENCY=$(echo "$BODY"   | jq -r '.transaction.currency')
TX_STATUS=$(echo "$BODY"     | jq -r '.transaction.status')
PRICING_MODEL=$(echo "$BODY" | jq -r '.pricingDetails.pricingModelApplied')
[[ -z "$TX_ID" || "$TX_ID" == "null" ]] && fail "id transaction manquant"
info "Transaction ID: ${TX_ID}"
info "Montant: ${TX_AMOUNT} ${TX_CURRENCY} | Modèle: ${PRICING_MODEL} | status: ${TX_STATUS}"

# ─── ÉTAPE 20: Payment intent (URL de paiement mock) ─────────────────────────
step "20" "POST /transactions/:id/payment-intent — Obtenir l'URL de paiement"
RESP=$(http POST "/transactions/${TX_ID}/payment-intent" "$TOKEN_SENDER" \
  '{"description":"Envoi de colis Paris → Douala — E2E Test"}')
assert_status "Payment intent" "$RESP" "201"
BODY=$(body_of "$RESP")
CHECKOUT_URL=$(echo "$BODY"       | jq -r '.checkoutUrl')
PAYMENT_PROVIDER=$(echo "$BODY"   | jq -r '.provider // "MOCK"')
info "Provider: ${PAYMENT_PROVIDER}"
info "Checkout URL: ${CHECKOUT_URL}"

# ─── ÉTAPE 21: Confirmer le paiement (mock) ───────────────────────────────────
step "21" "PATCH /transactions/:id/payment/success — Confirmer le paiement (mock)"
RESP=$(http PATCH "/transactions/${TX_ID}/payment/success" "$TOKEN_SENDER")
assert_status "Confirmation paiement" "$RESP" "200"
BODY=$(body_of "$RESP")
TX_PAY_STATUS=$(echo "$BODY" | jq -r '.transaction.paymentStatus // .paymentStatus')
TX_STATUS_2=$(echo "$BODY"   | jq -r '.transaction.status // .status')
AUTO_CODE=$(echo "$BODY"     | jq -r '.deliveryCode.code // "auto-émis"')
[[ "$TX_PAY_STATUS" == "SUCCESS" ]] \
  && ok "paymentStatus = SUCCESS ✓  |  Transaction status: ${TX_STATUS_2}" \
  || fail "paymentStatus attendu SUCCESS, obtenu: ${TX_PAY_STATUS}"
info "Code livraison auto-émis: ${AUTO_CODE}"

# ─── ÉTAPE 22: Acceptation légale — rôle plateforme ──────────────────────────
step "22" "POST /legal/transactions/:id/acknowledge-platform-role — Acceptation légale sender"
RESP=$(http POST "/legal/transactions/${TX_ID}/acknowledge-platform-role" "$TOKEN_SENDER")
assert_status "Acceptation rôle plateforme" "$RESP" "201"
info "PLATFORM_ROLE_NOTICE enregistré pour la transaction ${TX_ID}"

# ─── ÉTAPE 23: Acceptation légale — risque livraison ─────────────────────────
step "23" "POST /legal/transactions/:id/acknowledge-delivery-risk — Acceptation risque livraison"
RESP=$(http POST "/legal/transactions/${TX_ID}/acknowledge-delivery-risk" "$TOKEN_SENDER")
assert_status "Acceptation risque livraison" "$RESP" "201"
info "DELIVERY_RISK_NOTICE enregistré pour la transaction ${TX_ID}"

# ─── ÉTAPE 24: Générer / vérifier le code de livraison ───────────────────────
step "24" "POST /transactions/:id/delivery-code — Régénérer et vérifier le code de livraison"
RESP=$(http POST "/transactions/${TX_ID}/delivery-code" "$TOKEN_SENDER")
assert_status "Code livraison" "$RESP" "201"
BODY=$(body_of "$RESP")
DELIVERY_CODE=$(echo "$BODY" | jq -r '.code')
EXPIRES_AT=$(echo "$BODY"    | jq -r '.expiresAt')
[[ -z "$DELIVERY_CODE" || "$DELIVERY_CODE" == "null" ]] && fail "code de livraison manquant"
info "Code: ${DELIVERY_CODE} | Expire: ${EXPIRES_AT}"

# ─── ÉTAPE 25: Vérification du statut final ──────────────────────────────────
step "25" "GET /transactions/:id — Vérification du statut complet"
RESP=$(http GET "/transactions/${TX_ID}" "$TOKEN_SENDER")
assert_status "Statut final" "$RESP" "200"
BODY=$(body_of "$RESP")
FINAL_STATUS=$(echo "$BODY"     | jq -r '.status')
FINAL_PAYMENT=$(echo "$BODY"    | jq -r '.paymentStatus')
FINAL_AMOUNT=$(echo "$BODY"     | jq -r '.amount')
FINAL_CURRENCY=$(echo "$BODY"   | jq -r '.currency')
ESCROW=$(echo "$BODY"           | jq -r '.escrowAmount')
PAYIN_RAIL=$(echo "$BODY"       | jq -r '.payinRailProvider // "N/A"')
SENDER_EMAIL_RESP=$(echo "$BODY"   | jq -r '.sender.email')
TRAVELER_EMAIL_RESP=$(echo "$BODY" | jq -r '.traveler.email')

info "status            : ${FINAL_STATUS}"
info "paymentStatus     : ${FINAL_PAYMENT}"
info "amount            : ${FINAL_AMOUNT} ${FINAL_CURRENCY}"
info "escrowAmount      : ${ESCROW}"
info "payinRailProvider : ${PAYIN_RAIL}"
info "sender            : ${SENDER_EMAIL_RESP}"
info "traveler          : ${TRAVELER_EMAIL_RESP}"

[[ "$FINAL_STATUS"  == "PAID"    ]] && ok "status = PAID ✓"    || fail "status attendu PAID, obtenu: ${FINAL_STATUS}"
[[ "$FINAL_PAYMENT" == "SUCCESS" ]] && ok "paymentStatus = SUCCESS ✓" || fail "paymentStatus attendu SUCCESS, obtenu: ${FINAL_PAYMENT}"

# ════════════════════════════════════════════════════════════════════════════════
#  RÉSUMÉ
# ════════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  🎉  E2E MVP RÉUSSI — 25 étapes validées${NC}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════${NC}"
echo ""
echo -e "  Sender ID      : ${SENDER_ID}"
echo -e "  Traveler ID    : ${TRAVELER_ID}"
echo -e "  Corridor       : ${CORRIDOR_CODE} (${CORRIDOR_ID})"
echo -e "  Trip ID        : ${TRIP_ID}"
echo -e "  Package ID     : ${PACKAGE_ID}"
echo -e "  Transaction ID : ${TX_ID}"
echo -e "  Montant        : ${FINAL_AMOUNT} ${FINAL_CURRENCY}"
echo -e "  Code livraison : ${DELIVERY_CODE}"
echo ""
