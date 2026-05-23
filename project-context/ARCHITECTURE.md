# ARCHITECTURE — Valises Backend

## Overview

NestJS monolith with domain-driven module decomposition. Each module owns its service, controller, DTOs, and tests. No microservices; shared state via Prisma (PostgreSQL).

```
HTTP Request
    │
    ▼
[Global Guards]  AuthGuard → RolesGuard
[Global Pipes]   ValidationPipe (whitelist, forbidUnknown, transform)
[Interceptors]   RequestContextInterceptor (x-request-id)
[Filters]        HttpExceptionFilter → Sentry
    │
    ▼
Controller (DTO validation) → Service (business logic) → Prisma → PostgreSQL
                                     │
                              Provider Adapters
                         (Payment / Payout / Storage)
```

## Module map

### Auth & Identity
- `src/auth/` — `POST /auth/register`, `POST /auth/login` (public, rate-limited). JWT HS256, bcrypt passwords.
- `src/kyc/` — `GET /kyc/me`, `POST /kyc/me/session` (Stripe Identity), `POST /kyc/verifications/:id/sync`, `PATCH /kyc/users/:id/status` (ADMIN)
- `src/legal/` — `POST /legal/acceptances/me`, `GET /legal/acceptances/me`, `GET /legal/acceptances` (ADMIN), `POST /legal/transactions/:id/acknowledge-platform-role`, `POST /legal/transactions/:id/acknowledge-delivery-risk`, `POST /legal/packages/:id/acknowledge-rules`
- `src/user/` — `POST /users`, `GET /users`, `GET /users/:id` (**LEGACY STUB, pas de guards JWT**)

### Core Domain
- `src/trip/` — `POST /trips`, `GET /trips/me`, `POST /trips/:id/ticket-upload-intent`, `PATCH /trips/:id/submit-ticket`, `PATCH /trips/:id/publish`, `PATCH /admin/trips/:id/verify-ticket` (ADMIN)
- `src/package/` — `POST /packages`, `GET /packages/me`, `PATCH /packages/:id/declare-content`, `PATCH /packages/:id/review-content` (ADMIN), `PATCH /packages/:id/publish`, `PATCH /packages/:id/cancel`, `PATCH /packages/:id/declare-handover`, `PATCH /packages/:id/acknowledge-traveler-responsibility`
- `src/transaction/` — `POST /transactions`, `GET /transactions`, `GET /transactions/:id`, `PATCH /transactions/:id/status`, `POST /transactions/:id/cancel-before-departure`, `POST /transactions/:id/cancel-before-departure/traveler`, `POST /transactions/:id/block-after-departure`, `POST /transactions/:id/block-after-departure/traveler`, `POST /transactions/:id/delivery-code`, `PATCH /transactions/:id/confirm-delivery`, `PATCH /transactions/:id/release`, `PATCH /transactions/:id/payment/:status`, `POST /transactions/:id/payment-intent`, `GET /transactions/:id/ledger`
- `src/pricing/` — `GET /pricing/corridors`, `GET /pricing/corridors/:corridorCode`, `GET /pricing/corridors/:corridorCode/calculate`
- `src/matching/` — Sender↔traveler shortlist recommendations (matchScore 0-100, travelerTrustBadges, isRecommended)
- `src/abandonment/` — `POST /abandonment/mark`, `POST /abandonment/resolve`, `GET /abandonment/mine`, `POST /abandonment/process-due`
- `src/mobile-contract/` — `GET /mobile/me/contract` (snapshot user + KYC + trust + restrictions + capabilities)
- `src/activity-feed/` — `GET /activity-feed/me`, `GET /activity-feed/admin` (ADMIN)

### Financial
- `src/payment/` — Service-only. `POST /transactions/:id/payment-intent` exposé via TransactionController.
- `src/payout/` — `GET /payouts`, `GET /payouts/transactions/:transactionId`, `GET /payouts/:id`, `POST /payouts/transactions/:transactionId/request`, `POST /payouts/provider-events/ingest`, `POST /payouts/transactions/:transactionId/reconcile-provider-events`, `POST /payouts/:id/retry`, `PATCH /payouts/:id/approve`, `POST /payouts/:id/mark-paid`, `POST /payouts/:id/mark-failed` (tous ADMIN)
- `src/refund/` — `GET /refunds`, `GET /refunds/transactions/:transactionId`, `GET /refunds/:id`, `POST /refunds/provider-events/ingest`, `POST /refunds/transactions/:transactionId/reconcile-provider-events`, `POST /refunds/:id/retry`, `POST /refunds/:id/mark-refunded`, `POST /refunds/:id/mark-failed` (tous ADMIN)
- `src/ledger/` — Service-only (append-only escrow ledger, idempotency, balances). Injecté dans transaction/payout/refund/admin-ledger-integrity.
- `src/provider-webhook/` — `POST /provider-webhooks/events` (public, signature-ready, route vers payout/refund)

### Dispute & Compliance
- `src/dispute/` — Dispute lifecycle + SLA workflow (slaDeadline=createdAt+72h, escalation, partial refund, resolution templates)
- `src/evidence/` — `POST /evidence/upload-intents`, `POST /evidence/attachments/confirm-upload`, `POST /evidence/attachments`, `GET /evidence/attachments`, `GET /evidence/attachments/:id`, `PATCH /evidence/attachments/:id/review`, `GET /evidence/admin/summary`, `GET /evidence/admin/review-queue`
- `src/aml/` — `POST /aml/transactions/:transactionId/evaluate` (ADMIN), `GET /aml/cases` (ADMIN), `GET /aml/cases/:id` (ADMIN), `POST /aml/cases/:id/resolve` (ADMIN)
- `src/trust/` — `GET /trust/users/:userId/profile`, `POST /trust/users/:userId/events`, `POST /trust/users/:userId/restrictions`, `POST /trust/restrictions/:id/release`, `POST /trust/restrictions/expire-due`, `GET /trust/restrictions` (tous ADMIN)
- `src/enforcement/` — Service-only. Port d'assertions (no blocking restriction, AML check) injecté dans package/transaction/message.

### Messaging
- `src/message/` — `POST /transactions/:transactionId/messages`, `GET /transactions/:transactionId/messages` (ouvert après paiement confirmé, anti-circumvention + anti-spam)
- `src/notifications/` — `GET /notifications/me`, `POST /notifications/:id/ack`, `POST /notifications/emit` (ADMIN), `GET /notifications/admin/outbox` (ADMIN), `POST /notifications/admin/outbox/process-due` (ADMIN), `POST /notifications/admin/outbox/:id/retry` (ADMIN), `POST /notifications/admin/outbox/:id/cancel` (ADMIN)

### Admin Surface
- `src/admin-case-management/` — `GET /admin/case-management/cases`, `GET /admin/case-management/cases/:sourceType/:sourceId`, `POST /admin/case-management/cases/open`, `POST /admin/case-management/cases/:sourceType/:sourceId/{take,release,resolve,notes}`, `POST /admin/case-management/cases/bulk/{take,release,resolve}`
- `src/admin-financial-controls/` — `GET /admin/financial-controls/summary`, `GET /admin/financial-controls/cases`, `POST /admin/financial-controls/cases/bulk/ack`
- `src/admin-financial-operations/` — `GET /admin/financial-operations/summary`, `GET /admin/financial-operations/queue`
- `src/admin-ledger-integrity/` — `GET /admin/ledger-integrity/transactions/:transactionId`, `GET /admin/ledger-integrity/mismatches`
- `src/admin-transaction-operations/` — Queue (`GET queue`, `GET summary`, `GET transactions/:id`, `GET/PATCH/POST transactions/:id/case`, `POST transactions/:id/case/{resolve,reopen}`) + Playbooks (`GET playbooks`, `GET playbooks/summary`, `GET playbooks/transactions/:id`) + Timeline (`GET transactions/:id/timeline`)
- `src/admin-abandonment/` — 17 endpoints : gestion événements d'abandon + reminder jobs (list/get/create/resolve/dismiss/trigger/cancel/retry — unitaires et batch). ⚠️ Base path `@Controller('admin')`.
- `src/admin-ownership/` — `GET /admin/ownership/summary`, `GET /admin/ownership`, `GET /admin/ownership/:objectType/:objectId`, `POST /admin/ownership/claim`, `POST /admin/ownership/release`, `PATCH /admin/ownership/status`
- `src/admin-workload/` — `GET /admin/workload/{summary,overview,drilldowns,drilldowns/:preset,assignees,queues/:preset}`, `POST /admin/workload/actions/{claim,release,status,bulk-claim,bulk-release,bulk-status}`
- `src/admin-reconciliation/` — `GET /admin/reconciliation/summary`, `GET /admin/reconciliation/cases`, `POST /admin/reconciliation/cases/bulk/review`
- `src/admin-message-moderation-event/` — `GET /admin/message-moderation-events`, `GET /admin/message-moderation-events/:id`
- `src/admin-action-audit/` — `GET /admin/action-audits`, `GET /admin/action-audits/:id`. Service: `record()` / `recordSafe()` utilisés par tous les modules.
- `src/admin-timeline/` — `GET /admin/timeline`, `GET /admin/timeline/events/:id`, `GET /admin/timeline/:objectType/:objectId`, `POST /admin/timeline/events`
- `src/admin-dashboard-summary/` — 7 GET queues/summary + 8 POST bulk actions sur payouts/refunds/disputes/reminder-jobs
- `src/admin-ops/` — `GET /admin/ops/dashboard` (counts consolidés), `GET /admin/ops/cases` (flux unifié ops)
- `src/admin-support/` — (post-#268) Notes support, search transaction, full support view, webhook resend
- `src/admin-finance/` — (post-#272) Summary escrow/payout/revenue, orphan transactions, balance mismatches, PSP reconciliation

### Referral & Viral
- `src/referral/` — (post-#271) `GET /referral/my-code`, `POST /referral/apply`, `GET /referral/my-referrals`

### Fraud Prevention
- `src/fraud/` — (post-#267) Velocity check, payout cooldown, FraudFlag admin endpoints

### Reviews & Reputation
- `src/review/` — (post-#266) `POST /reviews`, `GET /reviews/me`, `GET /reviews/user/:id`

### Onboarding & Push
- `src/onboarding/` — (post-#264) Onboarding flow
- `src/push/` — (post-#264) Push notification tokens

### Infrastructure
- `src/prisma/` — PrismaService singleton
- `src/config/` — ConfigService, env validation (Joi), Sentry setup
- `src/common/` — Shared DTOs, decorators, filters, interceptors, utilities
- `src/storage/` — Provider abstraction : MOCK_STORAGE (dev/test) + S3 (staging/prod). Presigned PUT/GET URLs, bucket privé, séparation kyc/ vs assets/ par kind. Injecté dans trip + evidence.
- `src/health/` — `GET /health` (public, API + DB check)
- `src/readiness/` — `GET /ops/healthz` (liveness), `GET /ops/readyz` (readiness + DB check)

## Data model highlights

```
User ──< Trip ──< Transaction >── Package ──> User (sender)
                      │
                 ┌────┴─────┐
              Payment    Dispute ──< Evidence
                 │            └──> DisputeResolution
              LedgerEntry
                 │
           Payout / Refund
```

Key schema conventions:
- All monetary fields: `Decimal @db.Decimal(12,2)` — never `Float`
- All entities: `id String @id @default(uuid())`
- All entities: `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
- Idempotency: `idempotencyKey String @unique` on payment-sensitive tables
- Enums for all status fields (TransactionStatus, DisputeStatus, PayoutStatus, etc.)

## Auth model

```
POST /auth/register → hashed password (bcrypt) → User created
POST /auth/login    → JWT issued (HS256, configurable expiry)
Bearer token        → JwtStrategy extracts userId + role
@Public()           → skips AuthGuard
@Roles(Role.ADMIN)  → RolesGuard enforces
```

## Provider pattern

All external integrations follow the same pattern:

```typescript
interface PaymentProvider {
  createPaymentIntent(dto): Promise<PaymentIntent>
}

class MockPaymentProvider implements PaymentProvider { ... }
class CinetPayProvider implements PaymentProvider { ... }

// Selected at startup via PAYMENT_PROVIDER env var
```

Same pattern for: Storage, Payout, Refund.

## Transaction state machine

```
PENDING_PAYMENT
    ↓ payment confirmed
PAYMENT_CONFIRMED
    ↓ traveler accepts
CONFIRMED
    ↓ traveler picks up
IN_TRANSIT
    ↓ delivery code confirmed
DELIVERED
    ↓ (or dispute opened at any post-confirmation state)
DISPUTED → RESOLVED
```

## Testing strategy

| Layer | Tool | Database |
|---|---|---|
| Unit | Jest | Mocked |
| Integration (service) | Jest | Mocked Prisma |
| E2E | Jest + Supertest | Real PostgreSQL |

E2E tests run sequentially (`maxWorkers: 1`) to avoid race conditions on shared DB state.

## Security headers (Lot #263)

Helmet configured with: `contentSecurityPolicy`, `hsts`, `noSniff`, `frameguard`, `xssFilter`. CORS restricted to allowlist from `CORS_ORIGINS` env var.

## Deployment

- Build: `npm run build` → `dist/`
- Run: `node dist/main.js`
- Migrations: `npx prisma migrate deploy` (never `db push` in prod)
- Seed: `npx ts-node prisma/seeds/production-corridors.ts`
- CI: GitHub Actions on `develop` PRs (Node 20, PostgreSQL 15)
