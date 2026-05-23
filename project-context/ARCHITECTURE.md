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
- `src/auth/` — JWT strategy, guards, `@Public` / `@Roles` decorators, register/login
- `src/kyc/` — KYC verification (Stripe Identity sessions, status tracking)
- `src/legal/` — Legal document acceptance (ToS, Privacy, Delivery Risk Notice)

### Core Domain
- `src/trip/` — Trip creation, flight ticket upload, capacity management
- `src/package/` — Package creation, content declaration, compliance screening
- `src/transaction/` — State machine, delivery code, KYC gating, payment intent bridge
- `src/pricing/` — Per-corridor pricing config (per-kg, 23kg bundle, 32kg bundle)
- `src/matching/` — Sender↔traveler shortlist recommendations

### Financial
- `src/payment/` — Payment intent creation, provider dispatch
- `src/payout/` — Traveler payout workflow, provider events, approval gate
- `src/refund/` — Sender refund workflow, provider events
- `src/ledger/` — Append-only escrow ledger, idempotency, audit trail
- `src/provider-webhook/` — Incoming webhook normalization (CinetPay)

### Dispute & Compliance
- `src/dispute/` — Dispute lifecycle, evidence, resolution, outcome matrix
- `src/evidence/` — Generic evidence attachment with visibility controls
- `src/aml/` — AML screening, case management, risk levels
- `src/trust/` — User trust profile, reputation scoring, reputation events
- `src/enforcement/` — Behavior restrictions (WARNING → BLOCK_ACCOUNT)

### Messaging
- `src/message/` — Conversation and message CRUD, content sanitization
- `src/notifications/` — Notification dispatch (providers abstracted, not wired)

### Admin Surface
- `src/admin-case-management/` — Disputes + AML case management
- `src/admin-financial-controls/` — Financial oversight and compliance
- `src/admin-financial-operations/` — Payout and refund operations
- `src/admin-ledger-integrity/` — Ledger reconciliation and audit
- `src/admin-transaction-operations/` — Transaction tools and timelines
- `src/admin-abandonment/` — Abandonment events and reminder jobs
- `src/admin-ownership/` — Task assignment and SLA tracking
- `src/admin-workload/` — Workload distribution
- `src/admin-reconciliation/` — Reconciliation workflows
- `src/admin-message-moderation-event/` — Moderation review
- `src/admin-action-audit/` — Audit log (actor + target + action)
- `src/admin-timeline/` — Unified operational timeline
- `src/admin-dashboard-summary/` — Aggregated admin metrics
- `src/admin-ops/` — Operational utilities

### Infrastructure
- `src/prisma/` — PrismaService singleton
- `src/config/` — ConfigService, env validation (Joi), Sentry setup
- `src/common/` — Shared DTOs, decorators, filters, interceptors, utilities
- `src/storage/` — Provider abstraction (MOCK_STORAGE; S3/Cloudinary reserved)
- `src/health/` — `/health` endpoint (HTTP + DB)
- `src/readiness/` — Application readiness probes
- `src/activity-feed/` — User activity stream
- `src/mobile-contract/` — Mobile API contract (in refinement)

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
