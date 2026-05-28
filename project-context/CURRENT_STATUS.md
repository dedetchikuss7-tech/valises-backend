# CURRENT STATUS — Valises Backend

> Last updated: 2026-05-28 | Branch: feature/312-payout-history | Lot completed: #312 | Tests: ≥1185

## What this project is

**Valises** is a peer-to-peer parcel delivery marketplace connecting **senders** (people who need packages transported) with **travelers** (people already making the journey). The backend handles the full lifecycle: matching, pricing, payment escrow, delivery confirmation, dispute resolution, and financial payouts.

## Current state of the system

The backend is **production-architecture-ready**. Core domain flows are implemented and covered by E2E tests. The main gaps remaining are mobile contract refinement, notification delivery, and operational tooling hardening.

### What is fully operational
- Auth (JWT, Passport, rate limiting, CORS hardening)
- User registration + KYC gating for transactions
- Trip and package creation with compliance checks
- Transaction state machine (PENDING → CONFIRMED → IN_TRANSIT → DELIVERED)
- Delivery code generation and confirmation
- Dispute workflow (open, evidence, resolution, outcome)
- Escrow ledger (credits, debits, commission entries, idempotency)
- Payment via CinetPay (sandbox + production config) and MOCK fallback
- Payout workflow (manual approval, mock Stripe)
- Refund workflow (manual approval)
- Webhook ingestion and normalization (CinetPay, provider events)
- AML screening and case management
- Message moderation with sanitization and block events
- Trust profiles and reputation scoring
- Review system (post-transaction reviews, rating aggregation)
- Payout Schedule & History (lot #312): GET /payouts/my-history (cursor-paginated), GET /payouts/:id (owner-only, 404 non-leak), GET /payouts/my-next-eligible (eligibleAt estimée), notification push+email quand payout PAID
- Dispute Evidence File Validation (lot #311): POST /disputes/:id/evidence/upload-url (MIME validation by filename extension, 5 fichiers max, 10MB, participant only), GET /disputes/:id/evidence (accès loggé DocumentAccessLog), DisputeEvidence model (dispute_evidences table)
- Per-User Rate Limiting (lot #309): UserRateLimiterService in-memory sliding window, 4 endpoints rate-limitées (POST transactions/trips/compensation/reviews), 429 + Retry-After header, FraudFlag RATE_LIMIT_VIOLATION LOW (fire-and-forget), seuils configurables par env vars
- Traveler Availability Window (lot #308): departureDate/arrivalDate sur Trip, GET /trips/available?corridorCode&dateFrom&dateTo (public), PATCH /trips/:id/close (carrier uniquement), date proximity intégrée dans matchScore (max +10 pts), trips null-date toujours inclus (approche permissive)
- Package Weight & Dimensions Validation (lot #307): maxWeightKg/maxVolumeL/strictLimits sur Corridor, POST /admin/corridors/:code/limits, validation permissive (warning) ou stricte (400) selon strictLimits, limites exposées dans GET /corridors/:code
- Corridor Public Availability API (lot #305): GET /corridors (public, isActive=true, cached 5min), GET /corridors/:code (public, detail avec tarification indicative), invalidation immédiate au PATCH admin, isActive filtré dans matching, CorridorCacheService in-memory TTL
- Traveler Rating Gate (lot #304): POST /reviews bloqué si deliveryConfirmedAt null, GET /reviews/summary/:userId (score agrégé public + deliveriesCount), canReview boolean dans détail transaction, KNOWN_TRAPS.md mis à jour (modération future)
- Trust score enriched with badges (VERIFIED_TRAVELER, EXPERIENCED, TRUSTED) and reliabilityScore
- Fraud & abuse prevention (velocity checks, payout cooldown, FraudFlag model, admin flag resolution) — Fraud V2 : multi-account detection, impossible travel, payout farming V2 (30j/500k), runFullFraudCheck
- PaymentAttempt entity: tracks every PSP call (INITIAL/RETRY/MANUAL), integrated in PaymentIntentService, pspReference used as reconciliation key
- Protection Valises (lot #292): CompensationRequest, manual admin review, sender-only, 7-day window, 50k XAF cap
- Notification outbox wiring (lot #291): 5 events, idempotency, FR templates, NOTIFICATIONS_ENABLED flag
- Financial Audit Endpoint (lot #298): GET /admin/financial-audit/transaction/:id returns full snapshot (ledger, payment attempts, payouts, dispute, reconciliation, compensation, fraud flags), AuditAccessLog on every read, FINANCIAL_SOURCE_OF_TRUTH.md
- Alpha Readiness (lot #299): scripts/pre-launch-check.sh (7 checks), GET /admin/readiness (JSON report READY/NOT_READY), ALPHA_LAUNCH_CHECKLIST.md, final project-context docs updated
- User Suspension & Ban (lot #297): suspendedAt/bannedAt on User, UserStatusGuard (global), JWT ban rejection, POST suspend/unsuspend/ban, FraudFlag ADMIN_SUSPENSION, audit trail
- Corridor Activation Admin (lot #296): GET /admin/corridors, PATCH status/pricing, POST preview, pricingHistory snapshots, audit trail AdminActionAudit
- Trust level computed (lot #290): TrustLevel enum v1, computeTrustLevel() on-the-fly
- Chaos scenarios (lot #289): 7 Jest failure scenario tests
- Operational runbooks (lot #288): 5 incident runbooks in project-context/runbooks/
- Document lifecycle (lot #287): soft delete, DocumentAccessLog, KYC retention policy
- Payout auto semi-auto (lot #286): eligibility batch, TRUSTED criteria, admin approve queue
- Payment resilience: retryWithBackoff utility, exponential backoff + jitter, per-call timeout budget, maxTotalDurationMs, isCinetPayRetryableError predicate, integrated in PaymentIntentService
- Operational backoffice: support notes (SupportNote model), transaction search, full transaction support view, webhook resend
- Dispute SLA workflow: slaDeadline (createdAt+72h), escalation tracking, payout hold flag, resolution templates (REFUND_FULL/PARTIAL, RELEASE_TRAVELER, NO_ACTION)
- Matching Intelligence V1: matchScore 0-100 (KYC/rating/deliveries/corridor/penalty), travelerTrustBadges, isRecommended on candidates and shortlist; default sort by matchScore desc
- Referral & Viral Loops: ReferralCode (unique per user, 8-char alphanum), ReferralUse (anti-abuse, one per referred user), GET /referral/my-code, POST /referral/apply, GET /referral/my-referrals; grantReward marks rewardGranted; REFERRAL_REWARD ledger type reserved
- Reconciliation & Finance Ops: AdminFinanceModule — GET /admin-finance/summary (escrow/payout/revenue aggregates), GET /admin-finance/orphan-transactions (paid >48h, no payout), GET /admin-finance/balance-mismatches (escrowAmount != amount), GET /admin-finance/psp-reconciliation?dateFrom&dateTo (manual PSP reconciliation report)
- Admin modules: ownership, workload, reconciliation, ledger integrity, timeline, case management, financial controls, financial operations, dashboard summary, ops dashboard, action audit, message moderation events, abandonment management, transaction operations (queue + drilldown + playbooks + timeline)
- User-facing pré-#254 modules: abandonment tracking + reminder scheduling, activity feed, legal acceptances, evidence upload + review, mobile contract snapshot, AML screening + cases, pricing corridors
- Audit complet pré-#254 : 39 modules documentés dans project-context/PRE254_MODULES_AUDIT.md
- Security Sweep #274 : UserController sécurisé ADMIN (POST/GET /users), AbandonmentController.processDue sécurisé ADMIN, SECURITY_AUDIT.md exhaustif (48 controllers audités)
- Storage provider S3 : presigned PUT/GET URLs, bucket privé, MIME validation (jpeg/png/webp/pdf), expiry 15 min, séparation kyc/ vs assets/ par kind
- FlutterFlow integration guide : CORS wildcard *.flutterflow.app + *.fluttervision.com (CORS_ALLOW_FLUTTERFLOW), FLUTTERFLOW_INTEGRATION.md (9 sections), checklist Railway, 7 bugs d'intégration documentés
- Admin User Search & Management (lot #310): GET /admin/users (cursor-based, filters: email/kycStatus/trustLevel/suspended/banned), GET /admin/users/:id (full profile: trustLevel computed, active fraud flags, transaction stats), PATCH /admin/users/:id/kyc-status (reason mandatory, immutable audit trail via AdminActionAudit)
- Push Notifications Mobile (lot #302): DeviceToken model (IOS/ANDROID), POST /notifications/register-device, DELETE /notifications/unregister-device, FCM provider wired on 5 outbox events, token invalidation au logout (POST /auth/logout), nettoyage tokens UNREGISTERED (FCM feedback), fallback non-bloquant, PUSH_PROVIDER=MOCK default
- Email Delivery Wiring (lot #301): SendGrid provider wired on 5 outbox events via EmailModule (fetch-based), HTML templates FR (5 event types), unsubscribe token HMAC-SHA256 (CAN-SPAM), GET /unsubscribe one-click endpoint, GET /admin/notifications/failed DLQ review, EMAIL_DELIVERABILITY.md (SPF/DKIM/DMARC checklist), EMAIL_PROVIDER=MOCK default
- Webhook Retry Dashboard (lot #314): GET /admin/webhooks/failed (cursor-paginated, filter by provider), POST /admin/webhooks/:id/replay (rate limited 10/min per admin, FAILED only), GET /admin/webhooks/stats (failure rate by provider, configurable window up to 30 days), alert in OperationalHealthService if rate > 5%
- KYC Retry & Status Polling (lot #306): POST /kyc/retry (max 3 attempts from REJECTED), GET /kyc/status (detailed + canRetry), kycRejectionReason stored via webhook, POST /admin/kyc/:userId/override (reason mandatory, immutable audit trail)
- Transaction Cancellation Flow (lot #303): POST /transactions/:id/cancel (sender, before IN_TRANSIT, atomic), LedgerEntry ESCROW_DEBIT_REFUND idempotent, POST /admin/transactions/:id/force-cancel, chaos test concurrent cancellation
- Health & Observability Hardening (lot #300): Redis + BullMQ + notification outbox checks in /admin/operational-health, GET /admin/operational-health/metrics (pre-aggregated, fixed windows), structured JSON logging via Winston
- Operational observability : GET /admin/operational-health (transactions bloquées, payouts failed, notifications outbox, queue stats BullMQ, alertes seuils)
- Sentry integration (optional, env-gated)
- Swagger auto-docs (`/docs`)
- CI pipeline (GitHub Actions, PostgreSQL 15, Node 20)
- Production corridor seeds

### What is in progress / planned

The backend roadmap (lots #286–#299) is complete. The system is alpha-ready.

## Active branch conventions

| Prefix | Purpose |
|---|---|
| `feature/NNN-slug` | Lot implementation |
| `fix/NNN-slug` | Bug fix tied to a lot |
| `chore/slug` | Non-functional (deps, docs, CI) |

## Environment modes

| Mode | PAYMENT_PROVIDER | STORAGE_PROVIDER | Notes |
|---|---|---|---|
| Development | MOCK | MOCK_STORAGE | No external deps |
| Staging | CINETPAY | MOCK_STORAGE | CinetPay sandbox |
| Production | CINETPAY | S3 | Real keys required |

## Key invariants (do not break)

1. All monetary amounts use `Decimal(12,2)` — never `Float`
2. Ledger entries are append-only with idempotency keys
3. Delivery code confirmation is the only gateway to DELIVERED state
4. KYC must be VERIFIED before a sender can create a transaction
5. Admin endpoints require `ADMIN` role; user endpoints require `USER` role
6. E2E tests run with `maxWorkers: 1` (sequential) — do not change
7. Never skip `prisma migrate deploy` in CI; never use `db push` in production

## Lot history (last 10)

| Lot | Branch | Summary |
|---|---|---|
| #312 | feature/312-payout-history | Payout History: GET /payouts/my-history cursor-paginated, GET /payouts/:id owner-only, GET /payouts/my-next-eligible, notify on PAID |
| #311 | feature/311-dispute-evidence-validation | Dispute Evidence: upload-url endpoint, MIME validation, 5 files/10MB limits, GET evidence list, DocumentAccessLog |
| #309 | feature/309-per-user-rate-limiting | Per-User Rate Limiting: 4 endpoints, 429+Retry-After, FraudFlag RATE_LIMIT_VIOLATION LOW, env-configurable thresholds |
| #308 | feature/308-traveler-availability-window | Traveler Availability: departureDate/arrivalDate on Trip, GET /trips/available public, PATCH /trips/:id/close, date proximity in matchScore |
| #307 | feature/307-package-weight-validation | Weight Validation: maxWeightKg/maxVolumeL/strictLimits on Corridor, admin limits endpoint, warning vs 400 logic |
| #305 | feature/305-corridor-public-api | Corridor Public API: GET /corridors + GET /corridors/:code public cached, immediate cache invalidation on admin PATCH, isActive in matching |
| #304 | feature/304-traveler-rating-gate | Rating Gate: POST /reviews blocked if deliveryConfirmedAt null, GET /reviews/summary/:userId public, canReview in transaction detail |
| #302 | feature/302-push-notifications | Push Notifications: DeviceToken model, register/unregister endpoints, FCM provider, outbox dispatch, logout cleanup |
| #301 | feature/301-email-delivery-wiring | Email Delivery Wiring: SendGrid on 5 outbox events, HTML templates FR, unsubscribe HMAC, DLQ admin endpoint, EMAIL_DELIVERABILITY.md |
| #314 | feature/314-webhook-retry-dashboard | Webhook Retry Dashboard: failed list cursor-paginated, replay rate-limited, stats by provider, health alert >5% |
| #310 | feature/310-admin-user-search | Admin User Search: GET /admin/users cursor-paginated, GET /admin/users/:id full profile, PATCH kyc-status with mandatory reason + audit |
| #306 | feature/306-kyc-retry-status | KYC Retry: POST /kyc/retry, GET /kyc/status, rejectionReason webhook, admin override mandatory reason |
| #303 | feature/303-transaction-cancellation | Transaction Cancellation: sender cancel (CREATED/PAID), force-cancel admin, REFUND ledger idempotent, chaos test |
| #300 | feature/300-observability-hardening | Observability: Redis/BullMQ/outbox checks in healthz, GET /admin/operational-health/metrics pre-aggregated, Winston JSON logging |
| #299 | feature/299-alpha-readiness | Alpha Readiness: pre-launch-check.sh, GET /admin/readiness, ALPHA_LAUNCH_CHECKLIST.md, all project-context docs updated |
| #298 | feature/298-financial-audit-endpoint | Financial Audit Endpoint: full tx snapshot, AuditAccessLog model, FINANCIAL_SOURCE_OF_TRUTH.md, 8 unit tests |
| #297 | feature/297-user-suspension-ban | User Suspension & Ban: new User fields, UserStatusGuard global, JWT ban check in JwtStrategy, suspend/unsuspend/ban endpoints, FraudFlag ADMIN_SUSPENSION auto-created, audit trail |
| #296 | feature/296-corridor-activation-admin | Corridor Activation Admin: list, activate/deactivate, pricing update with history snapshots, preview endpoint, audit trail |
| #295 | feature/295-behavioral-architecture | Behavioral Architecture Map: 5 flow docs in project-context/flows/ with lastVerifiedAgainstCommit |
| #294 | feature/294-mobile-contract-v2 | Mobile Contract V2: GET /mobile-contract/v2, all enums, TrustLevel, payout auto flow, Protection Valises, breaking changes section, FLUTTERFLOW_INTEGRATION.md updated |
| #293 | feature/293-payment-attempt | PaymentAttempt entity: model, AttemptOrigin/PaymentAttemptStatus enums, createAttempt/resolveAttempt, integrated in PaymentIntentService, GET /admin/transactions/:id/payment-attempts |
| #292 | feature/292-protection-valises | Protection Valises: CompensationRequest model, manual review workflow, COMPENSATION_POLICY.md, 14 tests |
| #291 | feature/291-notification-delivery | Notification outbox: 5 events, idempotency, templates FR, NOTIFICATIONS_ENABLED flag, 10 tests |
| #290 | feature/290-trust-level | TrustLevel enum (EXPLORER/VERIFIED/TRUSTED/HIGH_TRUST), computeTrustLevel(), v1 rules, 13 tests |
| #289 | feature/289-chaos-scenarios | 7 chaos scenarios Jest mocks: duplicate webhook, PSP timeout, payout storm, expired code, etc. |
| #288 | feature/288-operational-runbooks | 5 incident runbooks + GET /admin/runbooks |
| #287 | feature/287-document-lifecycle | Document lifecycle: soft delete, DocumentAccessLog, KYC retention |
| #286 | feature/286-payout-auto | Payout auto semi-auto: eligibility batch, trusted criteria, admin approve queue |
| #284 | feature/284-payment-resilience | Payment resilience: retryWithBackoff utility (exponential backoff + jitter, callTimeoutMs, maxTotalDurationMs), isCinetPayRetryableError predicate (retryable: 5xx/network, definitive: 400/401/403/404/422), integrated in PaymentIntentService, 4 env vars (PSP_RETRY_ATTEMPTS/BASE_DELAY/MAX_DELAY/CALL_TIMEOUT), PAYMENT_RESILIENCE_SCENARIOS.md (6 scenarios), 16 unit tests |
| #283 | feature/283-fraud-v2 | Anti-Fraude V2 : checkMultiAccount (normalisation Gmail, flag MULTI_ACCOUNT HIGH), checkImpossibleTravel (corridor proxy, flag IMPOSSIBLE_TRAVEL MEDIUM), checkPayoutFarmingV2 (30j/500k, flag PAYOUT_FARMING_V2 HIGH), runFullFraudCheck (rapport agrégé 4 checks), POST /fraud/users/:id/full-check admin, FraudCheckResultDto étendu (flagged/relatedUserIds/metadata), 11 tests unitaires |
| #282 | feature/282-operational-observability | Operational observability : OperationalHealthModule, GET /admin/operational-health, getHealthSnapshot() avec transactions bloquées (PAID sans payout >48h, CREATED >24h, IN_TRANSIT >7j), payouts (REQUESTED/PROCESSING >48h, FAILED), notifications outbox (raw SQL), webhooks ProviderEvent FAILED 24h, queue stats BullMQ (lazyConnect-safe), alertes CRITICAL/WARNING par seuils, 5 tests unitaires |
| #281 | feature/281-bullmq-async-foundation | BullMQ async foundation : Redis + BullMQ v5, QueueModule (global, lazyConnect), WebhookWorker + NotificationWorker, QueueService (enqueueWebhook/enqueueNotificationOutbox), WEBHOOK_ASYNC_ENABLED feature flag (default false = sync rétrocompat) |
| #280 | feature/280-webhook-security | Webhook security hardening : raw body capture (express.json verify), CinetPay HMAC-SHA256 sur body brut (PROVIDER_WEBHOOK_SECRET_CINETPAY), replay protection verifyTimestamp (WEBHOOK_REPLAY_WINDOW_SECONDS=300s) |
| #279 | feature/279-flutterflow-connection | FlutterFlow first connection : CORS wildcard *.flutterflow.app (CORS_ALLOW_FLUTTERFLOW), FLUTTERFLOW_INTEGRATION.md (9 sections, 7 bugs, checklist Railway) |
| #278 | feature/278-kyc-provider | KYC provider pattern : Smile ID + Stripe Identity, POST /kyc/webhook auto-update, factory KycProviderModule, migration SMILE_ID enum |
| #277 | feature/277-production-readiness | Production readiness checklist : 4 scripts bash (10 checks E2E, idempotency collision, JWT expiré, concurrence), PRODUCTION_READINESS.md (backup DB, secrets rotation, rollback, PSP outage, env vars checklist) |
| #276 | feature/276-sendgrid-notifications | SendGrid provider : factory pattern, outbox branchement EMAIL/IN_APP, markOutboxFailed |
| #275 | feature/275-s3-storage-provider | S3StorageProvider : presigned PUT/GET (900s), bucket privé, MIME validation, séparation kyc/ vs assets/, Joi env validation conditionnelle |
| #274 | feature/274-security-sweep | Security sweep complet : UserController sécurisé ADMIN (privilege escalation critique), AbandonmentController.processDue HTTP guard ajouté, SECURITY_AUDIT.md (48 controllers, tableau exhaustif, webhook analysis) |
| #273 | feature/273-pre254-audit | Audit exhaustif des 39 modules pré-#254 : PRE254_MODULES_AUDIT.md (endpoints, rôle, état, gaps, décisions héritées), ARCHITECTURE.md enrichi avec vrais endpoints |
| #272 | feature/272-reconciliation-finance | AdminFinanceModule: summary, orphan-transactions, balance-mismatches, psp-reconciliation report (4 endpoints, admin-only) |
| #271 | feature/271-referral-viral-loops | ReferralCode + ReferralUse models, 3 endpoints (my-code/apply/my-referrals), grantReward, REFERRAL_REWARD enum |
| #270 | feature/270-matching-intelligence | matchScore 0-100, travelerTrustBadges, isRecommended on candidates + shortlist, sort by matchScore |
| #269 | feature/269-dispute-resolution-workflow | SLA timers (slaDeadline=createdAt+72h), escalation, payout hold, partial refund, resolution templates, 4 admin endpoints |
| #268 | feature/268-operational-backoffice-mvp | SupportNote model, admin-support endpoints: add/list notes, transaction search, full support view, webhook resend |
| #267 | feature/267-fraud-prevention | FraudFlag model, velocity check (>5 tx/24h), payout cooldown (6h), flagUser/getActiveFlags/resolveFlag, admin endpoints |
| #266 | feature/266-reputation-trust-system | Review model, POST /reviews, GET /reviews/me, GET /reviews/user/:id, getTrustProfile with badges & reliabilityScore |
| #265 | feature/265-flutterflow-mvp-connect | FlutterFlow integration guide, 20-endpoint validation script, mobile contract corridor UUID fix |
| #264 | feature/264a-context-engineering | Context engineering foundation (CURRENT_STATUS, ARCHITECTURE, DECISIONS, KNOWN_TRAPS) |
| #263 | feature/263-production-seed-security-cors | Production corridor seeds, security headers, CORS hardening |
| #262 | feature/262-commission-financial-snapshot-payout | Commission persistence, financial snapshot, manual payout approval |
| #261 | feature/261-webhooks-sentry-jwt | CinetPay webhooks, Sentry integration, JWT hardening |
| #260 | feature/260-cinetpay-sandbox-config | CinetPay sandbox/production config |
| #258 | feature/258-e2e-mvp-test | MVP E2E test script |
| #257 | feature/257-env-validation-psp | PSP env validation with conditional Joi rules |
| #256 | feature/256-psp-foundation | PSP foundation with CinetPay + Mock providers |
| #253 | feat/253-unified-operational-timeline-v2 | Unified operational timeline v2 |
| #252 | feat/252-delivery-proof-orchestration | Delivery proof orchestration |
| #251 | feat/251-dispute-operational-orchestration-v2 | Dispute operational orchestration v2 |

## How to run locally

```bash
npm run start:dev        # Dev server with watch
npm test                 # Unit tests
npm run test:e2e         # E2E tests (requires local Postgres)
npx prisma studio        # Browse database
```

## Files to check before starting a new lot

- `prisma/schema.prisma` — current data model
- `src/app.module.ts` — registered modules
- `project-context/DECISIONS.md` — rationale behind key choices
- `project-context/KNOWN_TRAPS.md` — pitfalls to avoid
- `project-context/lots/LOT_NNN.md` — previous lot spec for context
- `project-context/SECURITY_AUDIT.md` — tableau exhaustif sécurité (lot #274)
