## Lot #289 — Chaos Scenarios

### What this does
Adds 7 targeted failure scenario tests covering the most critical edge cases
in the system. All tests use Jest mocks — no real infrastructure required.

### Scenarios covered
1. **Duplicate webhook** — idempotency prevents double-processing of the same PSP event
2. **Delayed webhook** — a webhook arriving after the retry window is still processed correctly
3. **PSP timeout (all retries exhausted)** — exception surfaces, transaction state is not corrupted
4. **Redis unavailable at startup** — app starts in sync mode when `WEBHOOK_ASYNC_ENABLED=false`
5. **Payout retry storm** — concurrent `approvePayout` calls on the same payout: PSP called only once
6. **Expired delivery code** — rejected with explicit error, transaction remains `IN_TRANSIT`
7. **Reconciliation with PSP unavailable** — all cases skipped, run status is `COMPLETED` not `FAILED`

### Design
- Single file: `src/chaos/chaos-scenarios.spec.ts`
- No NestJS module, no controller, no migration
- Pure Jest mocks — intentionally simplified to test behavior contracts, not implementation details
- Reserved capacity for up to 3 additional scenarios without restructuring

### Tests
7 new unit tests. Total: ≥ 928.
