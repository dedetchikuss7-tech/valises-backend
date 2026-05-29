# MOBILE_ARCHITECTURE.md

> Created: 2026-05-28 | Phase Mobile FF00
> Référence de l'architecture FlutterFlow — à maintenir comme CURRENT_STATUS.md

---

## Base URL

Production : https://valises-backend-production.up.railway.app

---

## Pages

### Guest (non authentifié)
- SplashPage
- LoginPage
- RegisterPage
- ForgotPasswordPage

### Onboarding (authentifié, KYC non vérifié)
- ProfileSetupPage
- KYCUploadPage
- KYCStatusPage

### Sender (authentifié, KYC VERIFIED)
- SenderHomePage
- CreatePackagePage
- MatchingListPage
- TravelerProfilePage
- TransactionDetailPage
- PaymentPage
- PaymentResultPage
- DisputeOpenPage
- DisputeDetailPage

### Traveler (authentifié, KYC VERIFIED)
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

---

## AppState (variables globales persistées)

| Variable | Type | Stockage | Description |
|---|---|---|---|
| accessToken | String | SecureStorage | JWT Bearer token |
| refreshToken | String | SecureStorage | Pour renouveler l'accessToken |
| currentUserId | String | AppState | ID de l'utilisateur connecté |
| currentUserEmail | String | AppState | Email affiché |
| kycStatus | String | AppState | PENDING / VERIFIED / REJECTED |
| userRole | String | AppState | sender / traveler / both |
| trustLevel | String | AppState | EXPLORER / VERIFIED / TRUSTED / HIGH_TRUST |
| unreadNotifications | Integer | AppState | Badge count |

---

## Navigation
Non authentifié → SplashPage → LoginPage / RegisterPage
Authentifié + KYC PENDING/REJECTED → KYCStatusPage
Authentifié + KYC VERIFIED → SenderHomePage ou TravelerHomePage

Règle critique : vérifier kycStatus à chaque lancement depuis SplashPage.

---

## Groupes API

| Groupe | Endpoints couverts |
|---|---|
| Auth | /auth/login, /auth/register, /auth/refresh |
| User | /users/me, /users/me/sender-summary |
| KYC | /kyc/status, /kyc/retry, /kyc/submit |
| Trips | /trips, /trips/available, /trips/:id/close |
| Transactions | /transactions, /transactions/:id |
| Matching | /matching |
| Payment | /transactions/:id/initiate-payment |
| Delivery | /transactions/:id/confirm-delivery |
| Disputes | /disputes, /disputes/:id/evidence |
| Payouts | /payouts/my-history, /payouts/my-next-eligible |
| Notifications | /notifications/register-device |
| Referral | /referral/my-code, /referral/my-rewards |
| Corridors | /corridors, /corridors/:code |

---

## Stratégie JWT

1. Login → stocker accessToken + refreshToken en SecureStorage
2. Chaque API call → header `Authorization: Bearer {accessToken}`
3. Réponse 401 → appeler POST /auth/refresh → nouveau accessToken → retry
4. Refresh échoue → logout → redirect LoginPage
5. Logout → supprimer accessToken + refreshToken + vider AppState

---

## Stratégie erreurs API

| Code | Action |
|---|---|
| 400 | Afficher message d'erreur inline |
| 401 | Refresh token → retry → sinon logout |
| 403 | Afficher "Accès non autorisé" |
| 404 | Afficher "Non trouvé" |
| 409 | Afficher message de conflit (ex: déjà existant) |
| 410 | Gone — lien expiré (export GDPR) |
| 429 | "Trop de tentatives — réessayez dans X secondes" |
| 500 | "Erreur serveur — réessayez plus tard" |

---

## Réponse auth/login réelle

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "kycStatus": "PENDING"
  }
}
```

---

## Conventions

- Tous les montants sont en centimes XAF (Int) — diviser par 100 pour afficher
- Dates : ISO 8601 → formater côté FlutterFlow
- canReview / canCancel / canOpenDispute : toujours lire depuis l'API, jamais calculer côté app
- trustLevel : toujours lire depuis trustProfile.level, jamais calculer côté app