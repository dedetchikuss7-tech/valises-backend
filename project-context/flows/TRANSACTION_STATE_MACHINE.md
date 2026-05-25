# Transaction State Machine

lastVerifiedAgainstCommit: 126e432bd70599361eca0cce9756216a7b887def

## États

Extraits de l'enum `TransactionStatus` (Prisma) et de `TransactionStateMachine` (`transaction-state-machine.ts:7`) :

| Statut | Description |
|---|---|
| `CREATED` | Transaction créée, paiement en attente |
| `PAID` | Paiement confirmé, escrow actif, delivery code émis |
| `IN_TRANSIT` | [Réservé — non utilisé dans le flow V1 opérationnel] |
| `DELIVERED` | Livraison confirmée par delivery code |
| `CANCELLED` | Transaction annulée (avant ou après paiement) |
| `DISPUTED` | Transaction bloquée pour revue manuelle |

## Transitions autorisées

Source : `TransactionStateMachine.allowed` (`transaction-state-machine.ts:7-13`)

```
CREATED  → PAID        via [markPayment SUCCESS]              (transaction.service.ts:2833)
CREATED  → CANCELLED   via [updateStatus / cancelBeforeDeparture — avant paiement]
PAID     → CANCELLED   via [cancelBeforeDeparture (sender) / cancelBeforeDepartureByTraveler] (transaction.service.ts:1824)
PAID     → DISPUTED    via [blockAfterDeparture (sender) / blockAfterDepartureByTraveler]      (transaction.service.ts:2129)
PAID     → DELIVERED   via [confirmDeliveryWithCode — delivery code gateway UNIQUEMENT]         (transaction.service.ts:2520)
IN_TRANSIT → DISPUTED  via [updateStatus] — (non utilisé en V1)
DELIVERED  → DISPUTED  via [updateStatus]
CANCELLED  → (aucune)  terminal
DISPUTED   → (aucune)  terminal
```

## Préconditions par transition

### CREATED → PAID
- `markPayment(SUCCESS)` appelé par webhook PSP ou admin
- KYC du traveler = `VERIFIED` (`transaction.service.ts:1281`)
- Montant <= 2 000 000 XAF (`transaction.service.ts:2806`)
- Passe par `TransactionStateMachine.assertCanTransition` sauf dans `markPayment` (bypass direct)

### CREATED → CANCELLED
- Via `updateStatus` : vérifie `assertCanTransition` (`transaction.service.ts:1734`)
- Paiement pas encore confirmé (sinon erreur 400)

### PAID → CANCELLED
- Via `cancelBeforeDeparture` : sender ou admin, `paymentStatus=SUCCESS`, `status=PAID` (`transaction.service.ts:1785-1795`)
- Payout non démarré (status != REQUESTED|PROCESSING|PAID) (`transaction.service.ts:1797`)
- Solde escrow > 0 (`transaction.service.ts:1813`)
- Idem pour `cancelBeforeDepartureByTraveler` : traveler ou admin (`transaction.service.ts:1912-1949`)

### PAID → DISPUTED
- Via `blockAfterDeparture` : sender ou admin, `paymentStatus=SUCCESS`, `status=PAID`, trip déjà parti (`departAt <= now`) (`transaction.service.ts:2062-2127`)
- Via `blockAfterDepartureByTraveler` : idem côté traveler (`transaction.service.ts:2166-2298`)
- Crée ou réutilise un `Dispute` OPEN

### PAID → DELIVERED (delivery code uniquement)
- Via `confirmDeliveryWithCode` : traveler ou admin (`transaction.service.ts:2384`)
- Préconditions obligatoires (toutes vérifiées avant le `updateMany`) :
  1. `paymentStatus = SUCCESS` (`transaction.service.ts:2439`)
  2. `status = PAID` (`transaction.service.ts:2457`)
  3. Code à 6 chiffres (`/^\d{6}$/`) (`transaction.service.ts:2392`)
  4. Delivery code généré (`deliveryCodeHash`, `deliveryCodeSalt`, `deliveryCodeGeneratedAt`, `deliveryCodeExpiresAt` présents) (`transaction.service.ts:2488`)
  5. Delivery code non consommé (`deliveryCodeConsumedAt = null`) (`transaction.service.ts:2499`)
  6. Delivery code non expiré (`expiresAt >= now`) — TTL = 7 jours (`transaction.service.ts:2505`)
  7. Hash SHA-256 correspond (`code:salt`) (`transaction.service.ts:2509`)
  8. Pas de dispute OPEN (`transaction.service.ts:2463`)
  9. Payout non démarré (`transaction.service.ts:2477`)
- Écriture atomique via `updateMany` avec conditions redondantes (protection TOCTOU) (`transaction.service.ts:2520`)

## Ce qui ne peut pas revenir en arrière

États terminaux (zéro transition sortante) :

| État | Raison |
|---|---|
| `CANCELLED` | `allowed: []` — `transaction-state-machine.ts:12` |
| `DISPUTED` | `allowed: []` — `transaction-state-machine.ts:13` |

`DELIVERED` n'est pas terminal dans la state machine (`DELIVERED → DISPUTED` est autorisé) mais **ne peut pas revenir à PAID** — c'est un état de non-retour financier.

## Invariants

- `DELIVERED` ne peut être atteint **que** par `confirmDeliveryWithCode` — tentative via `updateStatus` lève `BadRequestException('DELIVERED must be confirmed through the delivery code flow')` (`transaction.service.ts:1745`)
- `IN_TRANSIT` n'est pas utilisé en V1 — `updateStatus` bloque explicitement (`transaction.service.ts:1751`)
- `TransactionStateMachine.assertCanTransition` est appelé dans `updateStatus` avant toute modification (`transaction.service.ts:1734`)
- Une transaction `PAID` avec paiement réussi ne peut pas être annulée via l'endpoint générique (`updateStatus`) (`transaction.service.ts:1736`)
- Le delivery code est lié à un seul usage (`deliveryCodeConsumedAt` est mutuellement exclusif avec une nouvelle confirmation)
- Chaque transition vers `DELIVERED` déclenche automatiquement `requestPayoutForTransaction` (`transaction.service.ts:2567`)
- Chaque annulation post-paiement déclenche automatiquement un `ReputationEvent` négatif (score -10) (`transaction.service.ts:2643`)
- Chaque ouverture de dispute déclenche automatiquement deux `ReputationEvent` négatifs (sender -5, traveler -5) (`transaction.service.ts:2607`)
