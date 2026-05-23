# DECISIONS — Valises Backend

Key architectural and technical decisions with their rationale. Read this before proposing changes that touch these areas.

---

## D-001 — NestJS monolith, not microservices

**Decision**: Single NestJS application with domain modules.

**Why**: Team size and feature velocity don't justify the operational overhead of microservices. Module boundaries enforce separation. Can extract services later if needed.

**Implication**: All modules share the same Prisma connection and PostgreSQL instance. Cross-module calls are direct service injection, not network calls.

---

## D-002 — Prisma ORM over TypeORM or raw SQL

**Decision**: Prisma with PostgreSQL.

**Why**: Type-safe client generated from schema, excellent migration tooling, readable schema syntax. TypeORM's decorator-heavy model was considered and rejected (runtime magic, harder to audit).

**Implication**: Schema is the single source of truth. Never bypass Prisma with raw SQL except in migrations. Never use `db push` in production — always `migrate deploy`.

---

## D-003 — Decimal(12,2) for all monetary values

**Decision**: `@db.Decimal(12,2)` on all monetary fields in Prisma schema.

**Why**: Floating-point arithmetic is unsuitable for money. IEEE 754 `float` loses precision at scale. Decimal is exact.

**Implication**: Application layer receives strings from Prisma for Decimal fields. Always parse with a Decimal library before arithmetic. Never store money in `Float` or `Int` (cents).

---

## D-004 — Append-only ledger with idempotency keys

**Decision**: `LedgerEntry` table is append-only. No updates, no deletes. Idempotency enforced by unique constraint on `idempotencyKey`.

**Why**: Financial audit requirements. Any balance can be derived by replaying entries. Idempotency prevents double-charges from retries.

**Implication**: Never UPDATE or DELETE ledger rows. To correct an error, add a reversal entry. The idempotency key must be deterministic (e.g., `${transactionId}:commission:v1`).

---

## D-005 — Provider pattern for external integrations

**Decision**: All external providers (payment, payout, refund, storage) implement a common interface selected at startup via env var.

**Why**: Enables local development with MOCK providers (no external accounts needed), easy provider swaps, and testability without mocking network calls.

**Implication**: New providers must implement the interface. Do not add provider-specific logic to services — put it in the provider class. Current production provider: CinetPay (payment).

---

## D-006 — KYC gating before transaction creation

**Decision**: Senders must have `KycStatus.VERIFIED` before they can create a transaction.

**Why**: Regulatory requirement. AML risk mitigation. Reduces fraud surface.

**Implication**: The transaction service checks KYC status synchronously before creating any transaction. Do not bypass this check even in tests — use a fixture that creates a verified user.

---

## D-007 — Delivery code as the sole gateway to DELIVERED state

**Decision**: A transaction can only reach `DELIVERED` state when the traveler presents a delivery code that the sender confirms.

**Why**: Prevents travelers from self-confirming delivery. Creates a two-party acknowledgment that protects both sides.

**Implication**: No admin override to force DELIVERED without a code confirmation (can be added with explicit audit trail if needed). The code is single-use and time-limited.

---

## D-008 — Sequential E2E tests (maxWorkers: 1)

**Decision**: E2E tests run one at a time, not in parallel.

**Why**: Tests share a real PostgreSQL database. Parallel runs cause race conditions on shared entities (users, transactions, ledger entries).

**Implication**: E2E suite is slower than unit tests. Do not change `maxWorkers`. If a test is slow, optimize the test, not the runner config.

---

## D-009 — RBAC with two roles: USER and ADMIN

**Decision**: Only two roles exist in `Role` enum. No per-resource permissions.

**Why**: Simplicity at current scale. Admin users have full access to all admin endpoints. User endpoints are self-scoped.

**Implication**: Do not add a third role without a lot specifically addressing RBAC expansion. Scope enforcement (e.g., "only the transaction parties can see this") is done in service logic, not middleware.

---

## D-010 — Webhook normalization via ProviderEvent

**Decision**: Incoming webhooks from CinetPay (and future providers) are first persisted as `ProviderEvent` records, then processed asynchronously.

**Why**: Prevents data loss if processing fails. Enables replay. Normalizes provider-specific payloads to internal events.

**Implication**: The `provider-webhook` module handles ingestion. Provider-specific parsing lives in the provider class. Business logic reacts to normalized internal events, not raw webhook payloads.

---

## D-011 — Helmet + CORS allowlist (Lot #263)

**Decision**: Security headers via Helmet (CSP, HSTS, noSniff, frameguard, XSS). CORS restricted to `CORS_ORIGINS` env var allowlist.

**Why**: Production hardening requirement. Wildcard CORS is a security risk.

**Implication**: Any new frontend origin must be added to `CORS_ORIGINS` in the deployment environment. Do not set `origin: '*'` in production config.

---

## D-012 — Swagger enabled only via env flag

**Decision**: `SWAGGER_ENABLED=true` is required to expose `/docs`. Off by default.

**Why**: Swagger exposes full API schema. In production, this should be disabled or IP-restricted.

**Implication**: Never hardcode `SwaggerModule.setup(...)` unconditionally. Always guard with the config flag.

---

## D-013 — Sentry optional, env-gated (Lot #261)

**Decision**: Sentry integration is opt-in via `SENTRY_DSN` env var. If not set, no error tracking.

**Why**: Avoids hard dependency on Sentry for local dev and staging. Keeps the app bootable without a Sentry account.

**Implication**: The Sentry init guard checks for `SENTRY_DSN` before initializing. Do not throw if DSN is missing.

---

## D-014 — Behavior restrictions are additive, not exclusive

**Decision**: A user can have multiple active `BehaviorRestriction` records simultaneously.

**Why**: A user might be LIMIT_TRANSACTIONS and BLOCK_MESSAGING at the same time for different reasons.

**Implication**: Restriction checks must query for any active restriction of the relevant type, not assume a single row per user.
