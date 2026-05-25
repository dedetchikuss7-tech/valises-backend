# Payment Flow

lastVerifiedAgainstCommit: 126e432bd70599361eca0cce9756216a7b887def

## Acteurs

- **Sender** (user authentifié) — initie la transaction et le paiement
- **PaymentIntentService** — orchestre l'appel PSP et la traçabilité
- **PaymentAttemptService** — crée et résout un enregistrement par appel PSP
- **PaymentProviderAdapter** — abstraction PSP (CinetPay ou MOCK selon `PAYMENT_PROVIDER`)
- **CinetPayProvider / MockPaymentProvider** — implémentations concrètes
- **TransactionService.markPayment** — appelé en retour (webhook ou admin) pour confirmer le paiement
- **LedgerService** — crédite l'escrow et accrues la commission
- **WebhookController / ProviderWebhookService** — gateway des événements entrants du PSP
- **AbandonmentService** — résout ou crée des enregistrements d'abandon
- **PushService** (optionnel) — notification push post-confirmation

## Préconditions

- La transaction doit exister (sinon NotFoundException) — `payment-intent.service.ts:43`
- Pour la confirmation du paiement (`markPayment` SUCCESS) :
  - Le KYC du traveler doit être `VERIFIED` — `transaction.service.ts:1281`
  - Le montant ne doit pas dépasser `2_000_000 XAF` — `transaction.service.ts:2806`
  - La transaction doit être au statut `CREATED` avec `paymentStatus=PENDING`

## Étapes

### Phase 1 — Création du PaymentIntent (initiation par le sender)

1. Le sender appelle `POST /transactions/:id/payment-intent` avec `CreatePaymentIntentDto` (`payment-intent.service.ts:39`)
2. `PaymentIntentService.createPaymentIntent` charge la transaction (`findUnique`) — lève `NotFoundException` si absente (`payment-intent.service.ts:43`)
3. Création d'un `PaymentAttempt` via `paymentAttemptService.createAttempt` — `attemptOrigin: 'INITIAL'`, `pspProvider: 'CINETPAY'` (`payment-intent.service.ts:51`)
4. Appel PSP via `retryWithBackoff` (config par env : `PSP_RETRY_ATTEMPTS` défaut 3, `PSP_RETRY_BASE_DELAY_MS` défaut 1000, `PSP_RETRY_MAX_DELAY_MS` défaut 10000, `PSP_CALL_TIMEOUT_MS` défaut 15000) — `payment-intent.service.ts:63`
   - CinetPay utilise `transactionId` comme clé d'idempotence native (déduplication côté provider)
   - Retryable : erreurs 5xx/réseau ; Définitif : 400/401/403/404/422 (`isCinetPayRetryableError`)
5. **Si succès PSP** : `resolveAttempt(SUCCESS, pspReference=paymentIntentId)` (`payment-intent.service.ts:94`)
6. Retour `PaymentIntentResponseDto` : `transactionId`, `checkoutUrl`, `paymentIntentId`, `provider`, `expiresAt` (`payment-intent.service.ts:100`)
7. **Si échec PSP** : `resolveAttempt(TIMEOUT|FAILED, errorCode, errorMessage)` + propagation de l'exception (`payment-intent.service.ts:85`)

### Phase 2 — Confirmation du paiement (callback webhook ou admin)

8. Le PSP envoie un webhook `POST /provider-webhooks/events` avec `objectType: PAYMENT`, `eventType: payment.success|payment.failed` (`provider-webhook.controller.ts:58`)
9. `ProviderWebhookService.handlePaymentEvent` résout le `transactionId` via champ direct ou `payinProviderReference` (`provider-webhook.service.ts:128`)
10. Appel `TransactionService.markPayment(transactionId, PaymentStatus.SUCCESS)` (`transaction.service.ts:2772`)
11. Si `paymentStatus === SUCCESS` :
    - Assertion KYC traveler (`assertTravelerVerifiedForPaymentSuccess`) — `transaction.service.ts:1271`
    - Vérification plafond 2 000 000 XAF — `transaction.service.ts:2806`
    - Résolution du routing payin (corridor → `payinPrimaryRail` ou `fallbackRail`) — `transaction.service.ts:2816`
    - Calcul commission (`resolveCommissionAndSnapshot`) : `senderPrice - travelerGain` — `transaction.service.ts:2753`
    - Mise à jour transaction : `status=PAID`, `paymentStatus=SUCCESS`, `escrowAmount=amount`, `commission`, `platformRevenue`, `pricingSnapshotJson` — `transaction.service.ts:2828`
    - Écriture ledger idempotente : `ESCROW_CREDIT` (clé `payment_success:{id}`) — `transaction.service.ts:2873`
    - Si commission > 0 : `COMMISSION_ACCRUAL` (clé `commission_accrual:{id}`) — `transaction.service.ts:2886`
    - Résolution abandonment `PAYMENT_PENDING` — `transaction.service.ts:2901`
    - Émission du delivery code (`issueDeliveryCode`) — `transaction.service.ts:2907`
    - Push notification sender (optionnel) — `transaction.service.ts:2909`

## Erreurs

| Code erreur | Déclencheur | Source |
|---|---|---|
| `NotFoundException` | Transaction introuvable | `payment-intent.service.ts:47` |
| `TIMEOUT` | PSP call dépasse `PSP_CALL_TIMEOUT_MS` | `payment-intent.service.ts:83` |
| `FAILED` | Erreur PSP non-retryable ou épuisement des retries | `payment-intent.service.ts:87` |
| `KycRequirementError` | Traveler KYC != VERIFIED | `transaction.service.ts:1283` |
| `LIMIT_EXCEEDED` | Montant > 2 000 000 XAF | `transaction.service.ts:2808` |
| `BadRequestException` | `paymentStatus` déjà SUCCESS (idempotence) | `transaction.service.ts:2783` |

## Invariants

- Chaque appel PSP génère exactement un `PaymentAttempt` (création avant l'appel, résolution après)
- CinetPay utilise `transactionId` comme clé d'idempotence — les retries ne créent pas de double charge côté provider
- Le ledger est append-only avec clés d'idempotence — un double webhook ne crédite pas deux fois l'escrow
- Le delivery code est toujours émis atomiquement avec la confirmation du paiement (même appel `markPayment`)
- La confirmation de paiement est la seule action qui fait passer `status` de `CREATED` à `PAID`
