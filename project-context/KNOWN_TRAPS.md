# KNOWN TRAPS — Valises Backend

Pitfalls that have caused bugs, confusion, or wasted time. Read before touching the relevant area.

---

## T-001 — Float for money will silently lose precision

**Area**: Any new model or DTO with an `amount` field.

**Trap**: Using `Float` or `number` for monetary values. Prisma maps `Float` to IEEE 754 double, which cannot represent values like `0.1` exactly. 100 + 0.1 + 0.2 ≠ 100.3.

**Fix**: Always use `Decimal @db.Decimal(12,2)` in schema and `Decimal.js` or similar for arithmetic. In DTOs, receive amounts as strings and parse explicitly.

**See**: Decision D-003.

---

## T-002 — `db push` in production destroys migration history

**Area**: Database maintenance, CI, onboarding.

**Trap**: Running `npx prisma db push` in any non-throwaway environment. It applies schema changes without creating a migration file, making the history diverge from `prisma/migrations/`.

**Fix**: Always use `npx prisma migrate dev` (dev) or `npx prisma migrate deploy` (CI/prod). Never run `db push` outside of local prototype work on a throwaway database.

**See**: Decision D-002.

---

## T-003 — E2E tests fail when run in parallel

**Area**: Test runner configuration.

**Trap**: Setting `maxWorkers > 1` in `test/jest-e2e.json`. Tests share a real PostgreSQL database. Parallel execution causes race conditions (duplicate unique keys, balance mismatches, state machine violations).

**Fix**: Keep `maxWorkers: 1`. If the suite is slow, investigate which tests can be merged or which setup/teardown is expensive.

**See**: Decision D-008.

---

## T-004 — Duplicate ledger entries from retry without idempotency key

**Area**: `src/ledger/`, payment confirmation handlers.

**Trap**: Creating a `LedgerEntry` in a code path that can be retried (webhook handler, background job) without setting a deterministic `idempotencyKey`. Retries create duplicate entries and corrupt the balance.

**Fix**: Always pass `idempotencyKey` when creating ledger entries in retry-able contexts. Key format: `${transactionId}:${entryType}:v1`. The unique constraint will reject duplicates gracefully.

**See**: Decision D-004.

---

## T-005 — Skipping KYC check in transaction tests

**Area**: E2E tests, transaction service.

**Trap**: Creating a transaction test that bypasses KYC by directly calling the service without a KYC-verified user. The test passes in isolation but fails in the real flow, masking the gate.

**Fix**: E2E tests must create a user and mark their KYC as VERIFIED (use the seed helper or a direct Prisma call in test setup) before attempting transaction creation.

**See**: Decision D-006.

---

## T-006 — CORS wildcard leaking into production

**Area**: `src/main.ts`, app bootstrap.

**Trap**: Using `app.enableCors()` without options, or hardcoding `origin: '*'`. This opens the API to cross-origin requests from any domain.

**Fix**: Always read `CORS_ORIGINS` from config and pass it as an array to `app.enableCors({ origin: [...] })`. The production env must set this var explicitly.

**See**: Decision D-011.

---

## T-007 — Swagger exposed without env gate

**Area**: `src/main.ts`, app bootstrap.

**Trap**: Calling `SwaggerModule.setup(...)` unconditionally. In production, the full API schema is exposed publicly, leaking endpoint structure and DTO shapes.

**Fix**: Always wrap Swagger setup with `if (configService.get('SWAGGER_ENABLED'))`. Do not add Swagger setup outside this guard.

**See**: Decision D-012.

---

## T-008 — TransactionStatus transition not validated in service

**Area**: `src/transaction/`, state machine.

**Trap**: Calling `prisma.transaction.update({ data: { status: newStatus } })` directly without going through the state machine. This allows invalid transitions (e.g., DELIVERED → PENDING_PAYMENT).

**Fix**: All status changes must go through `TransactionStateMachine.transition(currentStatus, targetStatus)`. The state machine throws on invalid transitions. Never bypass it.

---

## T-009 — Provider selection not validated at startup

**Area**: `src/config/`, env validation.

**Trap**: Setting an unknown value for `PAYMENT_PROVIDER` that doesn't match any enum. The app boots, but the payment service throws at runtime on the first payment attempt.

**Fix**: The Joi env schema validates `PAYMENT_PROVIDER` against the allowed enum values. Do not add a new provider without updating the Joi schema and registering the provider in the module's factory.

**See**: Decision D-005.

---

## T-010 — Admin endpoint accidentally public

**Area**: Any new admin controller.

**Trap**: Forgetting `@Roles(Role.ADMIN)` on an admin controller or specific endpoint. The AuthGuard still requires a valid JWT, but any authenticated user can access admin operations.

**Fix**: All admin controllers must have `@Roles(Role.ADMIN)` at the class level. Do not rely on the URL prefix (`/admin`) as a security boundary — it is naming convention only, not enforced by any guard.

**See**: Decision D-009.

---

## T-011 — Message content not sanitized before storage

**Area**: `src/message/`, new message endpoints.

**Trap**: Storing raw message content without sanitization. Users can embed harmful content (contact info, payment bypasses) that the platform is responsible for moderating.

**Fix**: Always pass message content through the sanitization pipeline in `MessageService` before persisting. The pipeline emits a `MessageModerationEvent` for blocked or sanitized content.

---

## T-012 — Decimal fields arrive as strings from Prisma

**Area**: Any service that reads monetary values from the database.

**Trap**: Treating a Prisma Decimal field as a JavaScript `number`. Prisma returns Decimal fields as `Prisma.Decimal` objects (or strings in some contexts). Passing them directly to arithmetic operators gives `NaN` or wrong results.

**Fix**: Explicitly call `.toNumber()` or use `Prisma.Decimal` arithmetic methods. In API responses, serialize as strings to preserve precision.

**See**: Trap T-001, Decision D-003.

---

## T-013 — Behavior restriction check misses concurrent updates

**Area**: `src/enforcement/`, `src/trust/`.

**Trap**: Caching the restriction list at request start and checking it once. A restriction added mid-request (rare, but possible for long-running operations) is not caught.

**Fix**: For critical operations (transaction creation, payout), always re-query restrictions immediately before the sensitive step, not just at request entry.

**See**: Decision D-014.

---

## T-014 — Webhook handler not idempotent

**Area**: `src/provider-webhook/`.

**Trap**: Processing the same webhook event twice if the provider retries delivery. Without deduplication, double-processing triggers double ledger entries, double state transitions.

**Fix**: Check `ProviderEvent.externalId` uniqueness before processing. If the event already exists, return 200 immediately without reprocessing. The unique constraint on `externalId` is the last line of defense.

**See**: Trap T-004, Decision D-010.

---

## Reviews — modération future

La modération des reviews (signalement, masquage, réponse) est volontairement hors scope pour l'alpha.
Le champ `comment` est stocké tel quel sans sanitization avancée au-delà de la validation de longueur.
Implémenter la modération dans un lot post-#320 uniquement si le volume le justifie.

## canReview — logique côté backend uniquement

`canReview` est calculé côté backend sur `deliveryConfirmedAt != null && status == DELIVERED`.
Ne jamais inférer cette logique côté FlutterFlow — toujours lire le champ depuis l'API.
