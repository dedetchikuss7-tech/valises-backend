# Payout Flow

lastVerifiedAgainstCommit: 126e432bd70599361eca0cce9756216a7b887def

## Acteurs

- **TransactionService** — déclenche le payout automatiquement après `confirmDeliveryWithCode`
- **PayoutService** — orchestre toutes les opérations payout
- **PayoutAutoService** — gère l'éligibilité semi-auto et l'approbation en lot (lot #286)
- **FraudService** — vérifie le cooldown anti-farming avant création du payout
- **LedgerService** — débite l'escrow quand le payout est marqué PAID
- **ManualPayoutProvider** — provider MANUAL (défaut)
- **MockStripePayoutProvider** — provider MOCK_STRIPE (routing Stripe)
- **AdminActionAuditService** — trace toutes les actions admin sur les payouts
- **ProviderWebhookService** — ingère les événements provider pour mettre à jour le statut

## Préconditions

Pour `requestPayoutForTransaction` :
- Transaction doit exister (`transaction.service.ts:1178`)
- Transaction status doit être `DELIVERED` ou `DISPUTED` (`payout.service.ts:1204`)
- `paymentStatus = SUCCESS` (`payout.service.ts:1213`)
- Escrow balance > 0 et releasable amount > 0 (`payout.service.ts:1219-1231`)
- FraudService.checkPayoutCooldown : pas de payout PAID dans les 6 dernières heures pour le traveler (`payout.service.ts:1194`)

Pour `markPaid` :
- Status doit être `REQUESTED` ou `PROCESSING` (`payout.service.ts:1513`)

Pour `approvePayout` (admin) :
- `requiresManualApproval = true` (`payout.service.ts:1370`)
- Status `READY` ou `REQUESTED` (`payout.service.ts:1374`)

## Flow manuel (déclenchement explicite admin)

1. Delivery confirmé → `TransactionService.confirmDeliveryWithCode` appelle `requestPayoutForTransaction` automatiquement (`transaction.service.ts:2567`)
2. **Anti-double-payout** : si payout déjà `REQUESTED/PROCESSING/PAID` → retour idempotent immédiat (`payout.service.ts:1165`)
3. `FraudService.checkPayoutCooldown` — bloque si payout PAID dans les 6 dernières heures (`payout.service.ts:1194`)
4. Vérification status transaction et paymentStatus (`payout.service.ts:1204`)
5. `LedgerService.getBalances` → vérifie `escrowBalance > 0` et `releasableAmount > 0` (`payout.service.ts:1219`)
6. `resolvePayoutRoutingForTransaction` : corridor → `payoutPrimaryRail` ou `fallbackRail` → provider MANUAL ou MOCK_STRIPE (`payout.service.ts:127`)
7. Création Payout : status `READY`, `requiresManualApproval = true` (`payout.service.ts:1305`)
8. `dispatchToProvider` : appel au provider, résultat normalisé en `REQUESTED` ou `PROCESSING` (`payout.service.ts:1646`)
9. **Admin approuve** via `approvePayout` : `READY → REQUESTED`, enregistre `approvedById`, `approvedAt` (`payout.service.ts:1357`)
10. **Admin marque PAID** via `markPaid` : `REQUESTED|PROCESSING → PAID`, ledger `ESCROW_DEBIT_RELEASE`, met à jour `escrowAmount` sur la transaction (`payout.service.ts:1522`)

## Flow semi-auto (lot #286 — critères d'éligibilité)

Constants : `COOLDOWN_HOURS = 48`, `TRUSTED_SCORE_MIN = 85`, `AUTO_BATCH_LIMIT = 50` (`payout-auto.service.ts:5-7`)

### Étape 1 — markEligibleBatch

- Cherche payouts `READY`, `autoEligible=false`, transaction `DELIVERED`, `deliveryConfirmedAt <= now - 48h` (`payout-auto.service.ts:21`)
- Limite : 50 candidats par lot
- Pour chaque candidat : `isUserEligibleForAuto(travelerId)` :
  - `userTrustProfile.score >= 85` (`payout-auto.service.ts:66`)
  - `fraudFlag.count(userId, resolvedAt=null) === 0` (`payout-auto.service.ts:69`)
- Si éligible : `autoEligible=true`, `eligibleAt=now` (`payout-auto.service.ts:47`)

### Étape 2 — getEligibleQueue

- Retourne payouts `READY`, `autoEligible=true`, `autoApprovedAt=null` triés par `eligibleAt` asc (`payout-auto.service.ts:76`)

### Étape 3 — approveEligible (admin lot)

- Pour chaque `payoutId` : vérifie payout `READY` + `autoEligible` (`payout-auto.service.ts:111`)
- Re-vérifie `isUserEligibleForAuto` (double check — conditions peuvent changer) (`payout-auto.service.ts:117`)
- Si toujours éligible : `autoApprovedAt=now`, `autoApprovedBy=adminId` puis `payoutService.approvePayout` (`payout-auto.service.ts:127`)

## Cycle de vie des statuts Payout

```
READY → REQUESTED (via dispatchToProvider ou approvePayout)
REQUESTED → PROCESSING (via provider event PROCESSING)
REQUESTED → PAID (via markPaid ou provider event PAID)
REQUESTED → FAILED (via markFailed ou provider event FAILED)
PROCESSING → PAID (via markPaid ou provider event PAID)
PROCESSING → FAILED (via markFailed ou provider event FAILED)
FAILED → READY (via retry — reset statut, dates nullées)
```

## Routing provider

Logique dans `mapRailToPayoutProvider` (`payout.service.ts:117`) :
- `PaymentRailProvider.STRIPE` → `PayoutProvider.MOCK_STRIPE`
- Tout autre rail (ou null) → `PayoutProvider.MANUAL`

## Erreurs

| Code | Déclencheur | Source |
|---|---|---|
| `NotFoundException` | Transaction ou payout introuvable | `payout.service.ts:1190` |
| `PAYOUT_COOLDOWN_ACTIVE` | Payout PAID dans les 6h pour ce traveler | `payout.service.ts:1198` |
| `BadRequestException` | Status transaction != DELIVERED ou DISPUTED | `payout.service.ts:1208` |
| `BadRequestException` | Escrow balance = 0 | `payout.service.ts:1221` |
| `BadRequestException` | Releasable amount = 0 | `payout.service.ts:1226` |
| `BadRequestException` | Montant > releasable amount | `payout.service.ts:1241` |
| `BadRequestException` | markPaid sur CANCELLED | `payout.service.ts:1503` |
| `BadRequestException` | markPaid sur FAILED (retry d'abord) | `payout.service.ts:1507` |
| `BadRequestException` | retry sur payout non FAILED | `payout.service.ts:1428` |

## Invariants

- Anti-double-payout : retour idempotent si payout déjà `REQUESTED/PROCESSING/PAID` — avant toute vérification de balance (`payout.service.ts:1165`)
- Le ledger (`ESCROW_DEBIT_RELEASE`) est écrit **dans la même transaction DB** que le `status=PAID` (`payout.service.ts:1522`)
- Le provider ne peut retourner que `REQUESTED` ou `PROCESSING` — tout autre statut lève `BadRequestException` (`payout.service.ts:1714`)
- `requiresManualApproval = true` sur toutes les créations de payout (aucun payout ne s'exécute sans validation humaine)
- Escrow debit et mise à jour `escrowAmount` sur la transaction sont atomiques (prisma.$transaction) (`payout.service.ts:1522`)
- Provider event avec `idempotencyKey` déjà vu → `IDEMPOTENT_REPLAY` sans re-traitement (`payout.service.ts:903`)
- Les états `PAID` et `CANCELLED` sont terminaux pour les événements provider (ignorés) (`payout.service.ts:688-710`)
