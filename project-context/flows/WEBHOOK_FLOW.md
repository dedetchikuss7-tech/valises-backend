# Webhook Flow

lastVerifiedAgainstCommit: 126e432bd70599361eca0cce9756216a7b887def

## Acteurs

- **PSP externe** (CinetPay, MOCK_STRIPE) — émet les événements HTTP
- **ProviderWebhookController** — endpoint public d'entrée (`POST /provider-webhooks/events`)
- **QueueService** — enqueue vers BullMQ si mode async activé
- **WebhookWorker** — consommateur BullMQ (`WEBHOOK_QUEUE`)
- **ProviderWebhookService** — normalisation, routing, traitement
- **ProviderWebhookSignatureService** — vérification HMAC et replay protection
- **PayoutService** — récepteur des événements `objectType=PAYOUT`
- **RefundService** — récepteur des événements `objectType=REFUND`
- **TransactionService** — récepteur des événements `objectType=PAYMENT`

## Sécurité

### HMAC Signature (lot #280)

Source : `provider-webhook-signature.service.ts`

| Provider | Algorithme | Payload signé | Secret env |
|---|---|---|---|
| `CINETPAY` | HMAC-SHA256 | `rawBody` brut (UTF-8) | `PROVIDER_WEBHOOK_SECRET_CINETPAY` |
| `MOCK_STRIPE` | HMAC-SHA256 | Canonical JSON (clés triées alphabétiquement, stable stringify) | `PROVIDER_WEBHOOK_SECRET_MOCK_STRIPE` ou `MOCK_STRIPE_WEBHOOK_SECRET` |

Statuts de vérification possibles :
- `VERIFIED` — signature valide
- `FAILED_MISSING_SIGNATURE` — header `x-provider-signature` absent alors que secret configuré → **401**
- `FAILED_INVALID_SIGNATURE` — HMAC ne correspond pas → **401**
- `BYPASSED_NO_SECRET` — secret non configuré → passe (mode dev)
- `BYPASSED_NO_RAW_BODY` — rawBody manquant pour CinetPay → passe
- `NOT_SUPPORTED_PROVIDER` — provider sans vérification HMAC → passe

Les statuts `FAILED_MISSING_SIGNATURE` et `FAILED_INVALID_SIGNATURE` lèvent `UnauthorizedException` (`provider-webhook.service.ts:44`).

### Replay Protection

- Header optionnel : `x-provider-timestamp` (Unix secondes ou millisecondes — auto-détecté)
- Fenêtre : `WEBHOOK_REPLAY_WINDOW_SECONDS` env var, défaut 300 secondes
- Timestamp absent → accepté sans vérification (backward compat)
- Timestamp invalide ou hors fenêtre → **401** (`provider-webhook.service.ts:59`)

## Mode sync vs async (`WEBHOOK_ASYNC_ENABLED`)

| Mode | Valeur env | Comportement |
|---|---|---|
| **Sync** (défaut) | `WEBHOOK_ASYNC_ENABLED=false` | Traitement direct dans le thread HTTP, réponse synchrone |
| **Async** | `WEBHOOK_ASYNC_ENABLED=true` | Enqueue dans BullMQ `WEBHOOK_QUEUE`, réponse immédiate 200 |

BullMQ concurrence : `BULL_WEBHOOK_CONCURRENCY` env var, défaut 3 (`webhook.worker.ts:12`)

## Étapes de traitement (chemin sync ou worker BullMQ)

1. Réception `POST /provider-webhooks/events` — endpoint `@Public()` (sans JwtAuthGuard) (`provider-webhook.controller.ts:29`)
2. Extraction headers : `x-provider-signature`, `x-provider-delivery-id`, `x-provider-timestamp`, `rawBody` (`provider-webhook.controller.ts:65`)
3. **Si async** : `queueService.enqueueWebhook(dto, headers)` → job BullMQ, sortie immédiate (`provider-webhook.controller.ts:75`)
4. **Si sync ou dans WebhookWorker** : `providerWebhookService.handleIncomingEvent(dto, headers)`
5. `normalizeEvent` :
   - Normalise provider (uppercase), eventType (lowercase avec mapping multi-alias), idempotencyKey
   - `assertProviderIsSupportedForObjectType` : PAYOUT → doit être `PayoutProvider` enum ; REFUND → doit être `RefundProvider` enum (`provider-webhook.service.ts:233`)
   - `assertIdentifierConsistency` : cohérence des identifiants selon objectType (`provider-webhook.service.ts:256`)
6. Vérification HMAC (voir section Sécurité) → `UnauthorizedException` si FAILED (`provider-webhook.service.ts:44`)
7. Vérification timestamp replay (`provider-webhook.service.ts:59`)
8. **Routing par `objectType`** :
   - `PAYOUT` → `payoutService.ingestProviderEvent(...)` (`provider-webhook.service.ts:76`)
   - `REFUND` → `refundService.ingestProviderEvent(...)` (`provider-webhook.service.ts:89`)
   - `PAYMENT` → `handlePaymentEvent(...)` (`provider-webhook.service.ts:103`)
   - Autre → `BadRequestException` (`provider-webhook.service.ts:107`)
9. **Pour `PAYMENT`** :
   - Événements supportés : `payment.success`, `payment.failed` uniquement (autres → ignoré avec `ignored: true`) (`provider-webhook.service.ts:115`)
   - Résolution `transactionId` : directement ou via `findByPayinProviderReference(externalReference)` (`provider-webhook.service.ts:128`)
   - `transactionId` toujours requis (direct ou via externalReference) — sinon 400 (`provider-webhook.service.ts:147`)
   - Appel `TransactionService.markPayment(transactionId, SUCCESS|FAILED)` (`provider-webhook.service.ts:157`)

## Normalisation des eventTypes

Source : `normalizeEventType` (`provider-webhook.service.ts:307`)

| objectType | Alias acceptés | eventType normalisé |
|---|---|---|
| PAYOUT | payout.requested, requested, payout.created | `payout.requested` |
| PAYOUT | payout.processing, processing, payout.updated.processing | `payout.processing` |
| PAYOUT | payout.paid, paid, payout.succeeded, succeeded, success | `payout.paid` |
| PAYOUT | payout.failed, failed | `payout.failed` |
| REFUND | refund.requested, requested, refund.created | `refund.requested` |
| REFUND | refund.processing, processing, refund.updated.processing | `refund.processing` |
| REFUND | refund.refunded, refunded, refund.succeeded, charge.refunded, succeeded, success | `refund.refunded` |
| REFUND | refund.failed, failed | `refund.failed` |
| PAYMENT | payment.success, success, succeeded | `payment.success` |
| PAYMENT | payment.failed, failed | `payment.failed` |

## Idempotency

- Chaque événement provider est enregistré dans `ProviderEvent` avec `idempotencyKey` unique
- Si `idempotencyKey` déjà vu → retour `IDEMPOTENT_REPLAY` immédiat sans re-traitement (`payout.service.ts:903`)
- `ProviderEvent.processingStatus` : `RECEIVED → APPLIED | IGNORED | FAILED`

## Erreurs et DLQ

| Erreur | HTTP | Déclencheur |
|---|---|---|
| `PROVIDER_WEBHOOK_SIGNATURE_INVALID` | 401 | Signature HMAC invalide ou absente |
| `PROVIDER_WEBHOOK_TIMESTAMP_INVALID` | 401 | Timestamp hors fenêtre ou format invalide |
| `BadRequestException` | 400 | objectType non supporté, identifiants incohérents, provider non reconnu |
| Pas de payout matchant | — | `IGNORED_NO_MATCH` — loggé dans AdminActionAudit, pas d'exception |
| Échec traitement provider event | — | `ProviderEvent.status=FAILED`, loggé dans AdminActionAudit, exception propagée |

**DLQ BullMQ** : si le worker BullMQ lève une exception, le job passe en `failed` avec `job.attemptsMade` tracé. Pas de DLQ automatique configurée dans le code lu — le monitoring se fait via `@OnWorkerEvent('failed')` (`webhook.worker.ts:29`).

## Invariants

- L'endpoint `POST /provider-webhooks/events` est `@Public()` — aucune JWT auth (`provider-webhook.controller.ts:29`)
- La sécurité repose **uniquement** sur HMAC + replay protection (pas d'IP allowlist dans le code lu)
- `rawBody` doit être capturé par middleware Express avant parsing JSON (requis pour CinetPay HMAC)
- Un événement webhook ne peut jamais re-processer un `ProviderEvent` avec `idempotencyKey` existant
- Les PAYOUT events ne peuvent contenir de `refundId` et vice-versa (assertion explicite) (`provider-webhook.service.ts:262`)
