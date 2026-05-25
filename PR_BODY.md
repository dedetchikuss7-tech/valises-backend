## Lot #294 — Mobile Contract V2

### Summary
Adds `GET /mobile-contract/v2` — a comprehensive JSON reference for FlutterFlow
covering all endpoints, enums, and flows added since V1 (lots #265–#293).
The V1 endpoint is preserved. `FLUTTERFLOW_INTEGRATION.md` updated with a
V2 header and new endpoint index.

### New endpoint
`GET /mobile-contract/v2` — public, no auth required.

### Contract sections
`auth`, `users`, `kyc`, `trips`, `transactions`, `payments`, `disputes`,
`payouts` (with auto-eligibility flow), `protectionValises`, `trustLevel`,
`notifications`, `reviews`, `matching`, `referral`, `storage`,
`enums` (full reference), `breakingChangesSinceV1`.

### Key additions vs V1
- Full `TrustLevel` enum with level rules and computation version
- `protectionValises` section: types, statuses, max amount, claim window
- `payouts.autoEligibilityFlow`: criteria and admin endpoints from lot #286
- `notifications`: events, idempotency key format, feature flag
- `enums`: 9 complete enums including `CompensationType`, `AttemptOrigin`,
  `PaymentAttemptStatus`
- `breakingChangesSinceV1`: 7 documented breaking changes

### No migrations
No schema changes in this lot.

### Tests
8 new unit tests on contract structure and invariants. Total: ≥ 985.
