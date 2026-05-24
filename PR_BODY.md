# Lot #284 — Payment Resilience

## Summary

- **Retry utility** (`src/common/utils/retry-with-backoff.ts`): generic `retryWithBackoff<T>` with exponential backoff, jitter, per-call timeout budget (`callTimeoutMs`), total duration budget (`maxTotalDurationMs`), and pluggable `isRetryable` predicate.
- **CinetPay error predicate** (`isCinetPayRetryableError`): retries on network errors and 5xx; short-circuits on definitive HTTP errors (400, 401, 403, 404, 422).
- **PaymentIntentService integration**: `createPaymentIntent` now wraps the PSP call with `retryWithBackoff`, reading retry config from env (`PSP_RETRY_ATTEMPTS`, `PSP_RETRY_BASE_DELAY_MS`, `PSP_RETRY_MAX_DELAY_MS`, `PSP_CALL_TIMEOUT_MS`). CinetPay idempotency is guaranteed by `transaction_id` passed in every request payload — retries never create duplicate charges.
- **Business state machine untouched**: no new `TransactionStatus` values, no changes to `markPayment`, no changes to the webhook handler.
- **16 new unit tests** covering success, retry-then-success, exhaustion, non-retryable errors, total duration abort, warn logging, and all error classification cases.
- **Scenarios document** (`project-context/PAYMENT_RESILIENCE_SCENARIOS.md`): six scenarios documented including the critical case where all retries timeout but the webhook still arrives and the transaction reaches PAID correctly.

## What changed

| File | Change |
|---|---|
| `src/common/utils/retry-with-backoff.ts` | New — retry utility + `isCinetPayRetryableError` predicate |
| `src/common/utils/retry-with-backoff.spec.ts` | New — 16 unit tests |
| `src/payment/payment-intent.service.ts` | `createPaymentIntent` wrapped with `retryWithBackoff`; Logger added; retry config read from ConfigService |
| `src/config/env.validation.ts` | 4 new optional env vars: `PSP_RETRY_ATTEMPTS`, `PSP_RETRY_BASE_DELAY_MS`, `PSP_RETRY_MAX_DELAY_MS`, `PSP_CALL_TIMEOUT_MS` |
| `project-context/PAYMENT_RESILIENCE_SCENARIOS.md` | New — 6 resilience scenarios documented |
| `project-context/CURRENT_STATUS.md` | Lot #284 added to history |

## Architecture decisions

- **No `PaymentAttempt` model** — retry metadata lives in-memory; a dedicated model is a future lot.
- **No new `TransactionStatus`** — retries are transparent infrastructure, invisible to the state machine.
- **`transaction_id` as idempotency key** — CinetPay natively deduplicates on `transaction_id`. No additional idempotency mechanism needed.
- **`paymentRetryMetadata` field skipped** — the field does not exist in the current Prisma schema; adding a Prisma update is deferred to a future lot that introduces the `PaymentAttempt` model.

## Test plan

- [x] `npm run build` — zero TypeScript errors
- [x] `npm test` — 878 tests, all passing (862 baseline + 16 new)
- [x] `retryWithBackoff` — success on first call, retry-then-success, exhaustion, non-retryable short-circuit, `maxTotalDurationMs` abort, warn logging
- [x] `isCinetPayRetryableError` — all HTTP status categories covered (400, 401, 403, 404, 422 → false; 500, 502, 503 → true; no status → true)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
