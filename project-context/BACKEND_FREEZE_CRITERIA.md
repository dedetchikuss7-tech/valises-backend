# BACKEND_FREEZE_CRITERIA.md

> Created: 2026-05-28 | Lot #319
> Purpose: Define contractually when the Valises backend is "complete enough to freeze"

---

## Purpose

This document does NOT define a perfect backend.

It defines the point at which:

> "The backend is sufficiently complete and stable that remaining improvements are no longer launch blockers."

Once all criteria are met and signed off, no new backend feature lot may be created without explicitly answering:

> **"Which criterion in this document is insufficiently satisfied, and why?"**

This question is a gate, not a suggestion.

---

## Definition of "Backend Complete"

The backend is complete when:

1. All critical business flows are implemented end-to-end without developer intervention
2. Operations can manage day-to-day incidents without touching code or DB directly
3. Financial integrity is auditable and append-only
4. The system can fail and recover with observable state
5. No known critical security gaps exist
6. All documentation reflects the real running system
7. Known limitations are explicitly accepted, not accidentally missing

---

## Non-Goals

The following are explicitly NOT required for freeze:

- Perfect fraud prevention
- Full automation of all operational decisions
- Bank-grade security
- Sub-100ms response times under production load
- Multi-region deployment
- GDPR-perfect implementation (minimum compliance is sufficient)
- 100% test coverage
- Zero technical debt
- Feature parity with mature competitors

---

## Freeze Criteria

---

### 1. Core Transaction Flows ✓

All critical user journeys are implemented and E2E-testable:

- [ ] User registration + KYC verification
- [ ] Trip creation by carrier
- [ ] Package/transaction creation by sender
- [ ] Matching (score-based, date-proximity, trust-gated)
- [ ] Payment via CinetPay (sandbox + production config)
- [ ] Delivery code generation and confirmation
- [ ] Transaction cancellation (sender + admin force)
- [ ] Dispute opening, evidence upload, resolution
- [ ] Payout to carrier (manual approval + auto-eligible batch)
- [ ] Refund to sender (manual approval)
- [ ] Review submission (delivery-gated)
- [ ] Compensation request (Protection Valises, 50k XAF cap)
- [ ] Referral code apply + reward grant on first delivery

**Verification**: `npm run test:e2e` passes. `GET /admin/readiness` returns READY.

---

### 2. Operational Autonomy ✓

Operations team can handle day-to-day incidents without developer:

- [ ] `GET /admin/users` — search, filter, suspend, ban
- [ ] `PATCH /admin/users/:id/kyc-status` — override with audit
- [ ] `POST /admin/transactions/:id/force-cancel` — unblock stuck transactions
- [ ] `GET /admin/webhooks/failed` + `POST .../replay` — webhook recovery
- [ ] `GET /admin/notifications/failed` — notification DLQ review
- [ ] `GET /admin/financial-audit/transaction/:id` — full financial snapshot
- [ ] `GET /admin/operational-health` — system health overview
- [ ] `GET /admin/readiness` — launch readiness report
- [ ] `GET /admin/runbooks` — incident runbooks accessible
- [ ] Payout approval queue functional
- [ ] Dispute resolution tools functional (SLA timer, escalation)

**Verification**: All admin endpoints return expected data in staging.

---

### 3. Financial Integrity ✓

No money is created, lost, or untracked:

- [ ] All monetary amounts stored as Int (centimes XAF) — no Float
- [ ] Ledger is append-only with idempotency keys
- [ ] Every transaction has a corresponding LedgerEntry set
- [ ] PaymentAttempt tracks every PSP call with pspReference
- [ ] Commission entries are persisted on every delivery
- [ ] Payout amounts are derived from ledger, not from transaction amount directly
- [ ] Refund flow creates ESCROW_DEBIT_REFUND entry (idempotent)
- [ ] REFERRAL_REWARD entries are idempotent
- [ ] `GET /admin/financial-audit/transaction/:id` covers every money movement

**Verification**: Run `scripts/pre-launch-check.sh`. All financial checks pass.

---

### 4. Observability & Recoverability ✓

The system can fail and be understood/recovered:

- [ ] `GET /admin/operational-health` reports DB, Redis, BullMQ queue depth
- [ ] Structured JSON logs via Winston (configurable level via LOG_LEVEL)
- [ ] Slow query middleware captures queries > 500ms
- [ ] `GET /admin/operational-health/performance/slow-queries` accessible
- [ ] Failed webhooks visible and replayable
- [ ] Notification outbox DLQ accessible
- [ ] BullMQ queue depth monitored with alert thresholds
- [ ] Sentry integration available (env-gated, optional)
- [ ] `scripts/pre-launch-check.sh` covers observability checks

**Verification**: Intentionally trigger a webhook failure. Verify it appears in `/admin/webhooks/failed` and can be replayed.

---

### 5. Security Minimum ✓

No known critical security vulnerabilities:

- [ ] All endpoints require authentication (JWT) or are explicitly `@Public()`
- [ ] All admin endpoints require `ADMIN` role
- [ ] All user endpoints require `USER` or `USER+ADMIN` role
- [ ] No privilege escalation paths (verified in SECURITY_AUDIT.md)
- [ ] KYC verified before sender can create transaction
- [ ] `UserStatusGuard` global — banned/suspended users blocked
- [ ] Webhook HMAC-SHA256 verification + replay protection
- [ ] S3 presigned URLs (private bucket, 15min expiry for KYC)
- [ ] Rate limiting on 4 write endpoints
- [ ] JWT hardened (short expiry, no sensitive data in payload)

**Verification**: `project-context/SECURITY_AUDIT.md` covers all controllers added in lots #300–#318.

---

### 6. Documentation Completeness ✓

Documentation reflects the real running system:

- [ ] `CURRENT_STATUS.md` — current lot, test count, what is operational
- [ ] `ARCHITECTURE.md` — real module structure
- [ ] `DECISIONS.md` — key architectural decisions with rationale
- [ ] `KNOWN_TRAPS.md` — pitfalls discovered during development
- [ ] `SCHEMA_REFERENCE.md` — all critical model fields and real names
- [ ] `SECURITY_AUDIT.md` — all controllers audited
- [ ] `PERFORMANCE_BASELINE.md` — audit findings and alpha targets
- [ ] `FINANCIAL_SOURCE_OF_TRUTH.md` — financial integrity rules
- [ ] `ALPHA_LAUNCH_CHECKLIST.md` — pre-alpha verification
- [ ] `EMAIL_DELIVERABILITY.md` — SPF/DKIM/DMARC checklist
- [ ] `FLUTTERFLOW_INTEGRATION.md` — mobile contract
- [ ] `flows/` — 5 behavioral flow docs
- [ ] `runbooks/` — 5 incident runbooks
- [ ] `KNOWN_LIMITATIONS.md` — see below

**Verification**: Read each file. Confirm it reflects lots #286–#318.

---

### 7. Known Limitations Accepted ✓

The following limitations are conscious decisions, not accidents:

See `project-context/KNOWN_LIMITATIONS.md` for the full list.

Summary of accepted limitations before beta:
- Push notifications not wired in production until FCM key configured
- Email not sent in production until SendGrid configured and DNS verified
- Rate limiting is in-memory (single instance) — Redis cluster not implemented
- Review moderation absent — manual moderation only
- No mobile fingerprinting for fraud prevention
- GDPR right to erasure partially implemented (export only, not full deletion pipeline)
- Currency display rates are indicative only — no contractual FX
- Payout schedule is approximate — `eligibleAt` is an estimate, not a guarantee
- Performance baseline is local-only — no production load test done

**Verification**: `KNOWN_LIMITATIONS.md` exists and is complete.

---

## Checklist Matrix

| Pillar | Owner | Status |
|---|---|---|
| 1. Core Transaction Flows | Backend | ☐ |
| 2. Operational Autonomy | Backend + Ops | ☐ |
| 3. Financial Integrity | Backend + Finance | ☐ |
| 4. Observability & Recovery | Backend | ☐ |
| 5. Security Minimum | Backend + Security | ☐ |
| 6. Documentation | Backend | ☐ |
| 7. Known Limitations Accepted | Product + Backend | ☐ |

---

## Sign-off Conditions

Backend is frozen when:

1. All 7 criteria are checked ✓
2. `GET /admin/readiness` returns `{ status: "READY" }` in staging
3. `scripts/pre-launch-check.sh` passes all checks
4. `KNOWN_LIMITATIONS.md` is complete and reviewed
5. This document is committed on `develop`

---

## Post-Freeze Rules

After freeze is declared:

**Allowed without gate:**
- Bug fixes
- Security patches
- Performance fixes for known production issues
- Documentation updates

**Requires gate question ("Which criterion is insufficiently satisfied?"):**
- Any new endpoint
- Any new module
- Any new abstraction
- Any new migration
- Any new dependency

**Never allowed post-freeze without explicit product decision:**
- New cross-cutting architectural patterns
- New authentication mechanisms
- New PSP integration
- Structural refactoring

---

## Coverage Verification — Lots #286–#318

| Criterion | Lots covering it |
|---|---|
| Core flows | #286–#308, #316 |
| Operational autonomy | #288, #296, #297, #298, #300, #303, #306, #310, #314 |
| Financial integrity | #262, #286, #293, #298, #303, #316 |
| Observability | #282, #288, #300, #318 |
| Security | #263, #274, #280, #297, #309 |
| Documentation | #264, #273, #277, #295, #318, #319 |
| Known limitations | #319 (KNOWN_LIMITATIONS.md) |
