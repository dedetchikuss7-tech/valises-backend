# Fraud & Trust Flow

lastVerifiedAgainstCommit: 126e432bd70599361eca0cce9756216a7b887def

## Acteurs

- **FraudService** — checks anti-fraude, création de FraudFlags
- **TrustLevelService** — calcul on-the-fly du TrustLevel (sans persistence)
- **TrustService** — gestion du profil de réputation, des événements, et des restrictions comportementales
- **TransactionService** — déclenche auto-wiring des events de trust après transitions de statut
- **PayoutService** — appelle FraudService.checkPayoutCooldown avant création payout
- **PayoutAutoService** — appelle `isUserEligibleForAuto` (score + flags) pour le batch semi-auto

## Checks disponibles (FraudService)

Source : `fraud.service.ts`

### 1. checkTransactionVelocity

- **Fenêtre** : 24 heures (`VELOCITY_WINDOW_HOURS = 24`)
- **Limite** : 5 transactions créées comme sender (`VELOCITY_TX_LIMIT = 5`)
- **Action si dépassé** : crée un `FraudFlag` type `VELOCITY_TX`, sévérité `HIGH`
- **Résultat** : `blocked: true`, reason `FRAUD_VELOCITY_LIMIT`
- **Intégration** : appelé dans `TransactionService.create` avant création (`transaction.service.ts:1426`)

### 2. checkPayoutCooldown

- **Fenêtre** : 6 heures (`PAYOUT_COOLDOWN_HOURS = 6`)
- **Condition** : payout PAID avec `updatedAt >= now - 6h` pour le traveler
- **Résultat** : `blocked: true`, reason `PAYOUT_COOLDOWN_ACTIVE` (pas de FraudFlag créé)
- **Intégration** : appelé dans `PayoutService.requestPayoutForTransaction` (`payout.service.ts:1194`)

### 3. checkMultiAccount

- **Algorithme** : normalisation Gmail (suppression dots + alias `+`), recherche users similaires (`startsWith(localPart)` + `contains(domain)`)
- **Seuil** : >= 2 utilisateurs similaires trouvés (hors soi-même)
- **Action si dépassé** : crée un `FraudFlag` type `MULTI_ACCOUNT`, sévérité `HIGH`
- **Résultat** : `blocked: false`, `flagged: true`, reason `MULTI_ACCOUNT_DETECTED`, `relatedUserIds`
- **Intégration** : appelé dans `runFullFraudCheck` uniquement (pas de blocage automatique)

### 4. checkImpossibleTravel

- **Fenêtre** : trips créés dans les 72 dernières heures
- **Condition** : dernier trip créé il y a < 2 heures ET `corridor.name (lowercase)` != `cityFrom (lowercase)`
- **Action si dépassé** : crée un `FraudFlag` type `IMPOSSIBLE_TRAVEL`, sévérité `MEDIUM`
- **Résultat** : `blocked: false`, `flagged: true`, reason `IMPOSSIBLE_TRAVEL_DETECTED`
- **Intégration** : appelé dans `runFullFraudCheck` uniquement

### 5. checkPayoutFarmingV2

- **Fenêtre** : 30 jours
- **Seuils** : > 15 payouts PAID **OU** totalAmount > 500 000 (unité : entier brut Prisma)
- **Action si dépassé** : crée un `FraudFlag` type `PAYOUT_FARMING_V2`, sévérité `HIGH`
- **Résultat** : `blocked: false`, `flagged: true`, reason `PAYOUT_FARMING_DETECTED`, metadata `{count, totalAmount}`
- **Intégration** : appelé dans `runFullFraudCheck` uniquement

### 6. runFullFraudCheck

- Exécute les 4 checks en parallèle (`Promise.all`) : velocity, payoutCooldown, multiAccount, payoutFarmingV2
- `blocked = true` si au moins un check retourne `blocked: true`
- `blockReason` = première raison de blocage trouvée
- `flagCount` = nombre de checks avec `blocked=true` ou `flagged=true`

## Types et sévérités de FraudFlag

| Type | Sévérité | Check source |
|---|---|---|
| `VELOCITY_TX` | HIGH | checkTransactionVelocity |
| `MULTI_ACCOUNT` | HIGH | checkMultiAccount |
| `IMPOSSIBLE_TRAVEL` | MEDIUM | checkImpossibleTravel |
| `PAYOUT_FARMING_V2` | HIGH | checkPayoutFarmingV2 |
| `DUPLICATE_ACCOUNT` | — | [réservé, non implémenté] |
| `PAYOUT_FARMING` | — | [réservé, remplacé par V2] |
| `SUSPICIOUS_PATTERN` | — | [réservé, non implémenté] |

Un flag est actif tant que `resolvedAt = null`. L'admin peut résoudre via `resolveFlag(flagId)`.

## TrustLevel computation v1 (TrustLevelService)

Source : `trust-level.service.ts`

Calculé **on-the-fly** à chaque appel — aucune persistence du niveau.

### Règles (hiérarchiques — chaque niveau requiert le précédent)

| Niveau | Conditions |
|---|---|
| `EXPLORER` | défaut (aucune condition remplie) |
| `VERIFIED` | `kycStatus === VERIFIED` |
| `TRUSTED` | `VERIFIED` + `score >= 70` + `deliveredCount >= 3` |
| `HIGH_TRUST` | `TRUSTED` + `score >= 85` + `deliveredCount >= 10` + `activeFraudFlags === 0` |

`deliveredCount` = transactions avec `status=DELIVERED` où `trip.carrierId = userId`
`activeFraudFlags` = `fraudFlag.count(userId, resolvedAt=null)`

### Signals capturés dans le résultat

`KYC_VERIFIED`, `SCORE_70`, `SCORE_85`, `N_DELIVERIES` (ex: `5_DELIVERIES`), `10_DELIVERIES`, `NO_FRAUD_FLAGS` (uniquement si HIGH_TRUST atteint)

`computationVersion: 'v1'`

## Profil de réputation (TrustService)

Source : `trust.service.ts`

- Score initial : `DEFAULT_SCORE = 100`, bornes `[0, 100]`
- Statut du profil : `RESTRICTED` (activeRestrictionCount > 0) > `UNDER_REVIEW` (score < 70) > `NORMAL`
- `reliabilityScore = max(0, min(100, 100 + deliverySuccessCount*2 - cancellationCount*3 - disputeCount*6))`

### Auto-wiring depuis TransactionService

Ces events sont créés idempotement (`recordEventIfMissing`, `dedupeScope=TRANSACTION`) :

| Déclencheur | Utilisateur concerné | Kind | scoreDelta |
|---|---|---|---|
| Delivery confirmé | Traveler | `POSITIVE_DELIVERY_CONFIRMED` | +10 |
| Annulation sender post-paiement | Sender | `NEGATIVE_SENDER_CANCELLED_AFTER_PAYMENT` | -10 |
| Annulation traveler post-paiement | Traveler | `NEGATIVE_TRAVELER_CANCELLED_AFTER_PAYMENT` | -10 |
| Dispute ouverte | Sender | `NEGATIVE_DISPUTE_OPENED` | -5 |
| Dispute ouverte | Traveler | `NEGATIVE_DISPUTE_OPENED` | -5 |

Sources : `transaction.service.ts:2607-2680`

### Badges (TrustService.getTrustProfile)

| Badge | Condition |
|---|---|
| `VERIFIED_TRAVELER` | `kycStatus === VERIFIED` |
| `EXPERIENCED` | `deliverySuccessCount >= 5` |
| `TRUSTED` | `averageRating >= 4.5` ET `reviewCount >= 3` |

## Restrictions comportementales (BehaviorRestriction)

- Imposées par admin via `imposeRestriction` : kind, scope (`GLOBAL`/autre), reasonCode, expiresAt optionnel
- Seulement les restrictions `ACTIVE` peuvent être relâchées (`releaseRestriction`)
- `expireDueRestrictions` : sweep batch (100 max) des restrictions expirées — déclenché admin
- Chaque changement de restriction recalcule `activeRestrictionCount` et `TrustProfileStatus`

## Escalade (quand un flag bloque une action)

| Check | Effet | Résolution |
|---|---|---|
| `VELOCITY_TX` (blocked) | Exception `ForbiddenException` dans `TransactionService.create` | Admin `resolveFlag` + manuelle |
| `PAYOUT_COOLDOWN_ACTIVE` (blocked) | Exception `ForbiddenException` dans `PayoutService.requestPayoutForTransaction` | Attendre 6h ou admin override |
| `MULTI_ACCOUNT` (flagged) | Pas de blocage auto — FraudFlag créé pour revue admin | Admin `resolveFlag` |
| `IMPOSSIBLE_TRAVEL` (flagged) | Pas de blocage auto — FraudFlag créé | Admin `resolveFlag` |
| `PAYOUT_FARMING_V2` (flagged) | Pas de blocage auto — FraudFlag créé | Admin `resolveFlag` |
| ActiveFraudFlag existant | Bloque `isUserEligibleForAuto` → exclut du batch semi-auto | Admin `resolveFlag` |

## Invariants

- Un `FraudFlag` est actif tant que `resolvedAt = null` — seul un admin peut le résoudre
- `TrustLevel.HIGH_TRUST` requiert **simultanément** score ≥ 85, ≥ 10 livraisons ET zéro flag actif
- Les events de réputation sont idempotents par `(userId, kind, reasonCode, transactionId)` — une transaction ne peut pas générer deux fois le même event
- Le score est borné `[0, 100]` via `clampScore` — jamais négatif ni > 100
- `isUserEligibleForAuto` (semi-auto payout) = score >= 85 ET activeFraudFlags = 0 (sous-ensemble de HIGH_TRUST sans vérification KYC ni deliveries)
- `TrustLevelService.computeTrustLevel` est sans effet de bord (lecture seule, pas de mise à jour en base)
