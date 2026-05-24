# Payment Resilience Scenarios — Lot #284

> Branch: feature/284-payment-resilience

## Context

`createPaymentIntent` calls CinetPay via HTTP. This call is subject to network timeouts and transient server errors. The retry utility (`retryWithBackoff`) wraps this call with exponential backoff and jitter. Retries are **transparent infrastructure**: the business state machine is never modified by retry logic.

CinetPay uses `transaction_id` as a native idempotency key (passed in every request payload). Re-submitting the same `transaction_id` after a timeout will not create a duplicate charge.

---

## Scenario A — Happy path

1. Sender calls `POST /payments/:transactionId/intent`
2. `createPaymentIntent` calls CinetPay → success on first attempt
3. CinetPay returns `payment_url`
4. API returns `{ checkoutUrl, paymentIntentId, ... }` to sender
5. Sender completes payment on CinetPay checkout page
6. CinetPay sends webhook `POST /webhooks/cinetpay`
7. `markPayment(SUCCESS)` called → transaction moves to `PAID`

**Result:** PAID ✓

---

## Scenario B — PSP timeout, retry succeeds

1. `createPaymentIntent` attempt 1 → timeout after `PSP_CALL_TIMEOUT_MS` ms
2. Retry logic logs warn, waits `baseDelay * 2^0 + jitter` ms
3. `createPaymentIntent` attempt 2 → success, returns `payment_url`
4. Continues as Scenario A

**Result:** PAID ✓  
**State machine impact:** none — transaction remains `CREATED` during retry window

---

## Scenario C — All retries timeout, then webhook arrives

1. `createPaymentIntent` attempts 1, 2, 3 → all timeout
2. `retryWithBackoff` exhausts `PSP_RETRY_ATTEMPTS` → throws to caller
3. API returns HTTP 503 to sender (no `checkoutUrl` delivered)
4. CinetPay had internally processed the first call successfully
5. CinetPay sends webhook → `markPayment(SUCCESS)` called → `PAID`

**Result:** PAID ✓ (webhook is source of truth)

**Risk:** The sender never received `checkoutUrl`, so they cannot complete the payment UI. However:
- The transaction is already `PAID` — no financial harm
- Sender can call `GET /transactions/:id` to check status
- If sender retries `createPaymentIntent`, CinetPay deduplicates via `transaction_id` and returns the same `payment_url`

---

## Scenario D — Duplicate webhook delivery

1. Webhook 1 arrives → `markPayment(SUCCESS)` called → `PAID`
2. Webhook 2 arrives (same event, network replay)
3. `markPayment` called again with same `idempotencyKey` → no-op (idempotency enforced in lot #280)

**Result:** PAID ✓, no double-credit

---

## Scenario E — Retry while webhook is processing concurrently

1. Retry 1 times out
2. Retry 2 begins (async)
3. Concurrently: webhook arrives → `markPayment(SUCCESS)` → `PAID`
4. Retry 2 returns `checkoutUrl` → caller receives URL, but transaction is already `PAID`

**Result:** PAID ✓. The returned `checkoutUrl` is stale/unused. No financial harm.  
**Mitigation:** UI should check transaction status (`GET /transactions/:id`) before redirecting to the checkout URL.

---

## Scenario F — Provider accepted but response lost (network cut mid-response)

1. CinetPay processes the intent internally
2. HTTP response is lost in transit → client sees a network error
3. Client retries via `retryWithBackoff`
4. Retry arrives at CinetPay with the same `transaction_id`
5. CinetPay deduplicates and returns the same `payment_url`

**Result:** Correct idempotent behavior ✓ (depends on CinetPay supporting idempotent re-submission via `transaction_id`)

---

## Critical invariant

> The business state machine (`CREATED` → `PAID` → `DELIVERED`) is **never modified** by retry logic.
>
> A transaction in state `CREATED` with an in-flight retry is still just `CREATED`. Retries are transparent infrastructure — they exist only to improve the probability that `createPaymentIntent` succeeds before returning to the caller.

---

## Error classification

| Category | Conditions | Action |
|---|---|---|
| Transient | Network timeout, `fetch()` throws, HTTP 500/502/503/504 | Retry with backoff |
| Definitive | HTTP 400, 401, 403, 404, 422 | Throw immediately, no retry |
| Unknown | No HTTP status on error object | Retry (safe default) |

In practice, `CinetPayProvider` wraps all errors as `BadGatewayException` (HTTP 502). The `isCinetPayRetryableError` predicate sees `status: 502` on all thrown errors and returns `true`. Definitive CinetPay API errors (wrong API key, invalid amount) would be retried — this is acceptable since: (a) such errors don't change between retries and eventually exhaust `PSP_RETRY_ATTEMPTS`; (b) they are rare in production; (c) deduplication via `transaction_id` prevents double charges.
