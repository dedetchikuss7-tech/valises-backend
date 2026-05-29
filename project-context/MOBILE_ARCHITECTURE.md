# MOBILE_ARCHITECTURE.md

> Created: 2026-05-28 | Updated: 2026-05-28 | Phase Mobile FF00

---

## Mobile Design Principles

1. Le backend est toujours la source de vérité — jamais FlutterFlow
2. Aucune logique métier dans FlutterFlow
3. Aucun état dupliqué — une seule source par donnée
4. Aucun pricing hardcodé
5. Aucune règle de trust hardcodée
6. Chaque action vient d'un appel API
7. Chaque permission vient d'un champ API (canCancel, canReview, canOpenDispute)
8. Ne jamais stocker durablement : trustProfile, pricing, transaction status, payout eligibility

---

## Base URL

Production : https://valises-backend-production.up.railway.app

---

## Pages

### Guest
- SplashPage
- LoginPage
- RegisterPage

### Onboarding
- KYCUploadPage
- KYCStatusPage

### Sender
- SenderHomePage
- CreatePackagePage
- MatchingListPage
- TravelerProfilePage
- TransactionDetailPage
- PaymentPage
- PaymentResultPage
- DisputeOpenPage
- DisputeDetailPage

### Traveler
- TravelerHomePage
- CreateTripPage
- TripDetailPage
- DeliveryCodeEntryPage
- PayoutHistoryPage

### Partagées
- NotificationsPage
- ProfilePage
- ReviewsPage
- ReferralPage
- SettingsPage
- ConnectionErrorPage

---

## AppState

| Variable | Type | Persisted | Justification |
|---|---|---|---|
| accessToken | String | true | Requis pour toute requête API |
| refreshToken | String | true | Renouvellement du JWT |
| currentUserId | String | true | Identifier l'utilisateur sans appel API |
| currentUserEmail | String | true | Affichage sans appel API |
| kycStatus | String | true | Cache UI — écrasé à chaque login |
| trustLevel | String | true | Cache UI — écrasé à chaque login |
| unreadNotifications | Integer | false | Compteur volatile |

### Note sur userRole

Valises n'a pas de rôle fixe. Un même utilisateur peut créer des trajets ET des colis.
L'app affiche les deux flows dès que kycStatus === VERIFIED.
Les permissions viennent exclusivement des champs API.

---

## Backend Source of Truth

Ne jamais calculer côté FlutterFlow :

| Champ | Source API |
|---|---|
| trustLevel | trustProfile.level — GET /users/me |
| canCancel | GET /transactions/:id |
| canReview | GET /transactions/:id |
| canOpenDispute | GET /transactions/:id |
| matchScore | GET /matching |
| eligibleAt | GET /payouts/my-next-eligible |
| Montants | Int centimes XAF → diviser par 100 pour afficher |

---

## Groupes API

> Note : vérifier contre Swagger déployé sur
> https://valises-backend-production.up.railway.app/docs
> avant chaque implémentation FlutterFlow.

| Groupe | Endpoints |
|---|---|
| Auth | POST /auth/login, POST /auth/register |
| User | GET /users/me, GET /users/me/sender-summary |
| KYC | GET /kyc/status, POST /kyc/retry |
| Storage | GET /storage/upload-url |
| Corridors | GET /corridors, GET /corridors/:code |
| Trips | GET /trips/me, POST /trips, GET /trips/available, PATCH /trips/:id/close |
| Transactions | GET /transactions, POST /transactions, GET /transactions/:id, POST /transactions/:id/cancel |
| Matching | GET /matching |
| Payment | POST /transactions/:id/initiate-payment |
| Delivery | POST /transactions/:id/confirm-delivery, GET /transactions/:id/delivery-code |
| Reviews | POST /reviews, GET /reviews/summary/:userId |
| Disputes | POST /disputes, GET /disputes/:id, POST /disputes/:id/evidence/upload-url |
| Payouts | GET /payouts/my-history, GET /payouts/my-next-eligible, GET /payouts/:id |
| Notifications | POST /notifications/register-device |
| Referral | GET /referral/my-code, GET /referral/my-rewards |
| Currencies | GET /currencies/rates |

---

## Stratégie JWT

1. Login → stocker accessToken + refreshToken (Persisted true)
2. Chaque appel → header `Authorization: Bearer {accessToken}`
3. Réponse 401 → Custom Action refresh → retry
4. Refresh échoue → vider AppState → redirect LoginPage
5. Logout → vider : accessToken, refreshToken, currentUserId, currentUserEmail, kycStatus, trustLevel

---

## Navigation
SplashPage
→ Pas de réseau → ConnectionErrorPage
→ accessToken vide → LoginPage
→ accessToken présent → GET /users/me
→ Erreur réseau → ConnectionErrorPage
→ kycStatus PENDING/REJECTED → KYCStatusPage
→ kycStatus VERIFIED → SenderHomePage (onglet Traveler disponible)

---

## Gestion des erreurs API

| Code | Action |
|---|---|
| 400 | Erreur inline — afficher champ `message` |
| 401 | Custom Action refresh token |
| 403 | Snackbar "Accès non autorisé" |
| 404 | Snackbar "Introuvable" |
| 409 | Snackbar message backend |
| 429 | Snackbar "Trop de tentatives — réessayez plus tard" |
| 500 | Snackbar "Erreur serveur" |
| Timeout/réseau | ConnectionErrorPage |

---

## Data Loading Rules

| Donnée | Règle |
|---|---|
| Listes (transactions, trips) | Cursor-based, jamais tout charger |
| Matching | Jamais mis en cache — toujours relire |
| Profil utilisateur | Rechargé à chaque login |
| Notifications | Refresh à chaque ouverture de la page |
| Taux de change | Cache FlutterFlow 1h max — indicatif uniquement |
| Transaction detail | Polling 15s si status IN_TRANSIT |

---

## Shared Components

À créer dès FF01 et réutiliser partout :

| Composant | Usage |
|---|---|
| LoadingOverlay | Spinner plein écran pendant appel API |
| ErrorBanner | Bandeau rouge message d'erreur |
| SuccessBanner | Bandeau vert confirmation |
| TransactionCard | Carte résumé dans les listes |
| TripCard | Carte résumé trajet |
| TrustLevelBadge | Badge EXPLORER/VERIFIED/TRUSTED/HIGH_TRUST |
| KYCStatusBadge | Badge statut KYC coloré |
| AmountDisplay | Montant XAF centimes → formaté lisible |

---

## Conventions

- Montants : Int centimes XAF ÷ 100 → afficher avec séparateur milliers
- Dates : ISO 8601 → DateFormat FlutterFlow
- AppState vide = utilisateur non connecté
- Erreurs : toujours lire le champ `message` de la réponse JSON
- Swagger : https://valises-backend-production.up.railway.app/docs