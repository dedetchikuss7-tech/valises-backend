## Lot #288 — Operational Runbooks

### What this does
Adds actionable incident runbooks for the 5 most critical operational failure
scenarios, plus a lightweight admin endpoint to list them.

### Runbooks created (project-context/runbooks/)
- `payout-failure.md` — diagnosis and recovery for failed payouts
- `psp-outage.md` — CinetPay outage procedure including MOCK fallback and post-outage reconciliation
- `webhook-recovery.md` — replaying missed webhooks, HMAC errors, BullMQ queue inspection
- `reconciliation-mismatch.md` — handling PSP_NOT_FOUND, PSP_STATUS_MISMATCH, AMOUNT_MISMATCH cases
- `fraud-escalation.md` — 4-level escalation ladder from monitoring to permanent ban

### Each runbook format
Symptoms / Diagnostic / Actions / Prevention

### New endpoint
`GET /admin/runbooks` — returns static list of available runbooks with slug, title, path, severity

### No migrations
No schema changes in this lot.

### Tests
5 new unit tests. Total: ≥ 921.
