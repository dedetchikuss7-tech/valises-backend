# FlutterFlow Integration Guide — Valises Backend

## ⚠️ Version actuelle : V2 (lot #294)

Endpoint de référence : `GET /mobile-contract/v2`

Nouveaux endpoints depuis la dernière mise à jour (lots #286–#293) :
- `GET /users/me/trust-profile` — trust level calculé côté serveur
- `DELETE /me/data` — suppression données personnelles (grace period 30j)
- `POST /compensation/request` — Protection Valises
- `GET /compensation/my-requests`
- `GET /admin/payout-auto/eligible-queue`
- `POST /admin/payout-auto/approve`

Enums ajoutés : TrustLevel, CompensationType, CompensationStatus,
AttemptOrigin, PaymentAttemptStatus

Breaking changes : voir section breakingChangesSinceV1 dans `GET /mobile-contract/v2`

---

> Lot #279 | Branch: feature/279-flutterflow-connection | Date: 2026-05-24

Ce guide couvre tout ce qu'il faut configurer côté Railway et côté FlutterFlow pour la **première connexion réelle sur device**.

---

## 1. Configuration CORS côté Railway

Variables d'environnement à définir dans le dashboard Railway avant le test :

```
CORS_ORIGINS=https://app.flutterflow.io
CORS_ALLOW_FLUTTERFLOW=true
```

- `CORS_ORIGINS` : liste séparée par virgules des origines exactes autorisées (toujours inclure `https://app.flutterflow.io`).
- `CORS_ALLOW_FLUTTERFLOW=true` : active le match wildcard pour `*.flutterflow.app` et `*.fluttervision.com` (URLs de preview FlutterFlow auto-générées).

Si tu veux aussi autoriser ton propre domaine de prod :

```
CORS_ORIGINS=https://app.flutterflow.io,https://ton-app.railway.app
CORS_ALLOW_FLUTTERFLOW=true
```

---

## 2. Endpoints essentiels pour FlutterFlow — liste complète

> Convention : **Auth requis** = header `Authorization: Bearer {access_token}` obligatoire.

### Auth (public — pas de Bearer)

| Méthode | Path | Body minimal | Réponse minimale |
|---|---|---|---|
| POST | `/auth/register` | `{ "email": "...", "password": "...", "role": "USER" }` | `{ "id", "email", "role", "kycStatus" }` |
| POST | `/auth/login` | `{ "email": "...", "password": "..." }` | `{ "access_token" }` |

### Mobile contract (USER)

| Méthode | Path | Auth requis | Réponse minimale |
|---|---|---|---|
| GET | `/mobile/me/contract` | Oui | Snapshot complet : user + KYC + trust + restrictions + capabilities |

### KYC (USER)

| Méthode | Path | Auth requis | Réponse minimale |
|---|---|---|---|
| GET | `/kyc/me` | Oui | `{ "kycStatus", "latestProviderSessionUrl" }` |
| POST | `/kyc/me/session` | Oui | `{ "providerSessionUrl" }` — URL à ouvrir dans WebView |

### Trips (USER)

| Méthode | Path | Auth requis | Body minimal | Réponse minimale |
|---|---|---|---|---|
| POST | `/trips` | Oui | `{ "departureCity", "arrivalCity", "departureDate", "availableKg" }` | Trip créé |
| GET | `/trips/me` | Oui | — | Liste des trips de l'utilisateur |

### Packages (USER)

| Méthode | Path | Auth requis | Body minimal | Réponse minimale |
|---|---|---|---|---|
| POST | `/packages` | Oui | `{ "title", "weightKg", "originCity", "destinationCity" }` | Package créé |
| GET | `/packages/me` | Oui | — | Liste des packages de l'utilisateur |

### Matching (USER)

| Méthode | Path | Auth requis | Réponse minimale |
|---|---|---|---|
| GET | `/matching/...` | Oui | Shortlist avec `matchScore`, `travelerTrustBadges`, `isRecommended` |

### Transactions (USER)

| Méthode | Path | Auth requis | Body minimal | Réponse minimale |
|---|---|---|---|---|
| POST | `/transactions` | Oui | `{ "packageId", "tripId" }` | Transaction créée (`PENDING_PAYMENT`) |
| GET | `/transactions` | Oui | — | Liste des transactions |
| GET | `/transactions/:id` | Oui | — | Détail transaction |
| POST | `/transactions/:id/payment-intent` | Oui | — | `{ "paymentUrl" }` |

### Notifications (USER)

| Méthode | Path | Auth requis | Réponse minimale |
|---|---|---|---|
| GET | `/notifications/me` | Oui | Liste des notifications |

### Pricing (public)

| Méthode | Path | Réponse minimale |
|---|---|---|
| GET | `/pricing/corridors` | Liste des corridors avec prix |

### Health (public)

| Méthode | Path | Réponse minimale |
|---|---|---|
| GET | `/health` | `{ "status": "ok" }` |
| GET | `/ops/readyz` | `{ "status": "ok" }` |

---

## 3. Flux d'authentification FlutterFlow

```
1. POST /auth/register ou POST /auth/login
   → réponse : { access_token: "eyJ..." }

2. Stocker access_token dans FlutterFlow App State
   (type: String, persisted: true)

3. Pour chaque API call authentifié :
   Header → Authorization: Bearer [App State: access_token]
   Header → Content-Type: application/json

4. Si réponse 401 → effacer App State + rediriger vers page Login
```

---

## 4. Flux KYC dans FlutterFlow

```
1. GET /kyc/me
   → lire kycStatus

2. Si kycStatus == "NOT_STARTED" ou "REJECTED" :
   POST /kyc/me/session
   → réponse : { providerSessionUrl: "https://..." }

3. Ouvrir providerSessionUrl dans un WebView (widget ou action)
   Attendre que l'utilisateur complète la vérification

4. Après fermeture du WebView :
   GET /kyc/me à nouveau
   → kycStatus devrait être "PENDING" ou "VERIFIED"

5. Si kycStatus != "VERIFIED" → afficher message d'attente
   (le webhook du provider mettra à jour le statut automatiquement)
```

> **Note** : Pour les tests sans vrai KYC, utiliser `PATCH /kyc/users/:id/status` (ADMIN) pour forcer `VERIFIED`.

---

## 5. Bugs d'intégration connus et workarounds

### Bug 1 — CORS preflight OPTIONS

**Symptôme** : FlutterFlow envoie une requête OPTIONS avant chaque POST. Si le serveur répond 404 ou 500 sur OPTIONS, la requête POST ne part pas.

**Cause** : CORS mal configuré ou middleware qui intercepte OPTIONS avant NestJS.

**Workaround** : La config CORS NestJS actuelle inclut `OPTIONS` dans `methods` et répond automatiquement aux preflights avec 200. Si le problème persiste en prod, vérifier que Railway ne strip pas les headers CORS.

---

### Bug 2 — Content-Type manquant sur les POST FlutterFlow

**Symptôme** : `400 Bad Request` avec message `"Unexpected token"` ou body vide reçu par NestJS.

**Cause** : FlutterFlow oublie parfois `Content-Type: application/json` sur les POST/PATCH.

**Workaround** : Dans chaque API Call FlutterFlow, ajouter **explicitement** dans les headers :
```
Content-Type: application/json
```

---

### Bug 3 — Token JWT expiré silencieux

**Symptôme** : L'app FlutterFlow reçoit 401 mais n'en informe pas l'utilisateur — UI bloquée.

**Cause** : JWT expire après 7 jours (configurable via `JWT_EXPIRES_IN`). FlutterFlow ne gère pas 401 par défaut.

**Workaround** : Implémenter un **Error Response Handler** global dans FlutterFlow :
- Sur chaque API Call, dans l'onglet "On Error" → si `statusCode == 401` → effacer App State (access_token) → naviguer vers page Login.

---

### Bug 4 — HTTPS requis pour les WebViews KYC

**Symptôme** : Stripe Identity ou Smile ID refusent de charger dans un WebView pointant vers `http://`.

**Cause** : Les providers KYC exigent HTTPS dans les URLs de retour.

**Workaround** : Toujours utiliser l'URL Railway (`https://...railway.app`) pour les tests sur device réel. Ne jamais utiliser `http://localhost` pour les flows KYC.

---

### Bug 5 — Decimal fields reçus comme strings

**Symptôme** : FlutterFlow parse `"125.00"` comme String, pas comme double — erreurs de comparaison.

**Cause** : Prisma sérialise les champs `Decimal(12,2)` en strings JSON pour éviter les pertes de précision.

**Workaround** : Dans FlutterFlow, déclarer ces champs comme `String` dans le Data Type, puis utiliser `double.parse(value)` (Custom Function) avant tout calcul numérique.

Champs concernés : `amount`, `escrowAmount`, `commissionAmount`, `availableKg`, `weightKg`, `pricePerKg`.

---

### Bug 6 — Null vs undefined dans les réponses

**Symptôme** : FlutterFlow traite `null` comme valeur par défaut du type (0 pour int, "" pour String) — conditions qui ne se déclenchent pas.

**Cause** : NestJS retourne `null` pour les champs optionnels non renseignés.

**Workaround** : Dans les conditions FlutterFlow, utiliser `isSet()` ou comparer explicitement à `null` plutôt qu'à la valeur par défaut du type.

---

### Bug 7 — FlutterFlow et les enums Prisma

**Symptôme** : FlutterFlow reçoit `"PENDING_PAYMENT"` mais l'Enum FlutterFlow est configuré avec des valeurs différentes.

**Cause** : Les enums backend sont en SCREAMING_SNAKE_CASE, FlutterFlow peut les interpréter comme String.

**Workaround** : Déclarer les champs de statut comme `String` dans FlutterFlow et utiliser des conditions `== "PENDING_PAYMENT"` (comparaison string exacte).

---

## 6. Checklist avant test sur device

```
[ ] CORS_ORIGINS contient l'URL FlutterFlow preview (ex: https://app.flutterflow.io)
[ ] CORS_ALLOW_FLUTTERFLOW=true configuré dans Railway
[ ] JWT_SECRET configuré dans Railway (openssl rand -base64 64)
[ ] JWT_EXPIRES_IN=7d configuré dans Railway
[ ] NODE_ENV=production dans Railway
[ ] PAYMENT_PROVIDER=MOCK (pour les tests initiaux sans CinetPay réel)
[ ] STORAGE_PROVIDER=MOCK_STORAGE (pour les tests sans S3)
[ ] NOTIFICATIONS_PROVIDER=MOCK (pour les tests sans SendGrid)
[ ] SWAGGER_ENABLED=false (optionnel, pour la performance en prod)
[ ] bash scripts/production-readiness-check.sh → 10/10 checks passent
[ ] Un utilisateur test créé via POST /auth/register
[ ] KYC du user test mis à VERIFIED via PATCH /kyc/users/:id/status (admin token)
[ ] Test smoke : GET /health → { "status": "ok" }
[ ] Test auth : POST /auth/login → access_token reçu
[ ] Test contract : GET /mobile/me/contract avec Bearer → 200
```

---

## 7. Variables Railway complètes pour le test FlutterFlow

```bash
# Core
NODE_ENV=production
PORT=3000
DATABASE_URL=<Railway PostgreSQL URL — auto-injectée>

# Auth
JWT_SECRET=<openssl rand -base64 64>
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGINS=https://app.flutterflow.io
CORS_ALLOW_FLUTTERFLOW=true

# Providers (mode test)
PAYMENT_PROVIDER=MOCK
STORAGE_PROVIDER=MOCK_STORAGE
NOTIFICATIONS_PROVIDER=MOCK
KYC_PROVIDER=STRIPE_IDENTITY

# Swagger (désactiver en prod)
SWAGGER_ENABLED=false

# Sentry (optionnel)
# SENTRY_DSN=https://...
```

---

## 8. Tester manuellement depuis FlutterFlow Test Mode

FlutterFlow Test Mode exécute l'app dans le navigateur (domaine `*.fluttervision.com`) — les requêtes CORS viendront de ce domaine. Avec `CORS_ALLOW_FLUTTERFLOW=true`, ces origines sont autorisées automatiquement.

Pour tester depuis un device physique via FlutterFlow Run mode : l'app tourne nativement (pas de CORS — les requêtes HTTP natives n'envoient pas d'`Origin` header). Le backend laisse passer les requêtes sans `Origin` (comportement same-origin/non-browser).

---

## 9. Debugging CORS en production

Si une requête est bloquée par CORS :

1. Ouvrir DevTools → onglet Network → chercher la requête OPTIONS (preflight)
2. Vérifier le header `Access-Control-Allow-Origin` dans la réponse
3. Si absent → le backend a rejeté l'origin → vérifier `CORS_ORIGINS` dans Railway
4. Logs Railway : chercher `CORS: origin X not allowed` dans les logs applicatifs

Pour ajouter temporairement une origine en debug :
```
CORS_ORIGINS=https://app.flutterflow.io,https://preview-abc123.fluttervision.com
```

Ou activer le wildcard si l'origin se termine par `.fluttervision.com` :
```
CORS_ALLOW_FLUTTERFLOW=true
```
