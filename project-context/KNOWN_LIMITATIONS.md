# KNOWN_LIMITATIONS.md

> Created: 2026-05-28 | Lot #319
> These are conscious decisions, not accidental omissions.

---

## Purpose

This document defines the boundary between "complete for beta" and "perfect".

Every item here was evaluated and consciously accepted before launch.
None of these items are bugs. They are known constraints with understood tradeoffs.

---

## Notification Delivery

**Limitation**: Email and push notifications require production credentials to function.
- Email: requires `EMAIL_PROVIDER=SENDGRID` + valid `SENDGRID_API_KEY` + DNS records (SPF/DKIM/DMARC)
- Push: requires `PUSH_PROVIDER=FCM` + valid `FCM_SERVER_KEY`
- Default: both providers run in MOCK mode (log only)

**Impact**: Users will not receive notifications until credentials are configured.
**Mitigation**: `EMAIL_DELIVERABILITY.md` checklist. Configuration is operational, not code.
**When to resolve**: Before public beta launch.

---

## Rate Limiting

**Limitation**: Rate limiting is in-memory per process instance.
- Works correctly for single-instance Railway deployment
- Does NOT work correctly across multiple instances (horizontal scaling)

**Impact**: In multi-instance deployment, rate limits could be bypassed.
**Mitigation**: Railway runs single instance for alpha. Rate limiting is a fraud signal (FraudFlag), not a hard security gate.
**When to resolve**: If horizontal scaling is needed — replace with Redis-backed counter.

---

## Review Moderation

**Limitation**: No automated moderation of review content.
- Comments are stored as-is (basic length validation only)
- No profanity filter, no abuse detection, no report-and-hide workflow

**Impact**: Abusive reviews may appear on user profiles.
**Mitigation**: Manual moderation by ops. Volume is low at alpha.
**When to resolve**: Post-beta, when review volume justifies automation.

---

## Mobile Fingerprinting

**Limitation**: No device fingerprinting for fraud prevention.
- Multi-account detection relies on email normalization (Gmail dots/+aliases) only
- No hardware-level device binding

**Impact**: Determined fraudsters can create multiple accounts from same device.
**Mitigation**: KYC verification is the primary anti-fraud gate. Email normalization catches casual abuse.
**When to resolve**: Fraud V3 — only if fraud patterns emerge at scale.

---

## GDPR Right to Erasure

**Limitation**: Data export is implemented. Full data deletion pipeline is partial.
- `POST /me/data/export-request` → JSON export ✓
- `DocumentLifecycleService.requestDataDeletion()` exists but full cascade deletion is not fully automated

**Impact**: GDPR Article 17 (right to erasure) is partially compliant.
**Mitigation**: Manual deletion workflow available for ops. Acceptable for alpha/beta in CEMAC jurisdiction.
**When to resolve**: Before EU market expansion.

---

## Currency Display

**Limitation**: XAF→EUR/USD rates are indicative only.
- Sourced from `open.er-api.com` free tier (no SLA)
- Cached 1 hour in-memory
- `indicative: true` is always present in responses
- Rates are NEVER used for financial calculations

**Impact**: Displayed amounts in EUR/USD are approximate.
**Mitigation**: Always labeled "indicative". Financial source of truth is always XAF.
**When to resolve**: Not a blocker. Rates are display-only by design.

---

## Payout Schedule

**Limitation**: `eligibleAt` on Payout is an estimate, not a contractual date.
- Calculated from delivery date + cooldown period
- Admin approval is still required (or auto-approval for TRUSTED users)

**Impact**: Carriers cannot rely on a guaranteed payout date.
**Mitigation**: `GET /payouts/my-next-eligible` provides a best estimate. Documented in user communications.
**When to resolve**: Post-beta, with payout SLA definition.

---

## Performance Under Load

**Limitation**: Performance baseline is measured against local DB only.
- No load test against production Railway + managed PostgreSQL
- No connection pool tuning for high concurrency
- No CDN or edge caching

**Impact**: Performance under real production load is unknown.
**Mitigation**: `PERFORMANCE_BASELINE.md` defines alpha targets. Railway auto-scales within plan limits.
**When to resolve**: Pre-beta load test against staging with production-like data volume.

---

## Dispute Arbitration

**Limitation**: Dispute resolution is manual admin decision.
- No automated resolution based on evidence analysis
- No SLA enforcement beyond tracking (slaDeadline exists, but no auto-escalation to external)

**Impact**: Disputes require ops attention within 72h.
**Mitigation**: Escalation tracking exists. Ops runbook covers dispute flow.
**When to resolve**: Post-beta, if dispute volume requires automation.

---

## Multi-PSP Fallback

**Limitation**: Single PSP (CinetPay) with no automatic fallback.
- If CinetPay is unavailable, payments fail
- `retryWithBackoff` handles transient errors but not sustained outages

**Impact**: CinetPay outage = payment outage.
**Mitigation**: `OPERATIONAL_RUNBOOKS` covers PSP outage scenario. Admin can force-cancel stuck transactions.
**When to resolve**: Multi-PSP integration if CinetPay reliability becomes an issue.

---

## AuditAccessLog Field Naming

**Limitation**: `AuditAccessLog` uses `accessedById` (confirmed), but `targetType`/`targetId` fields may not exist.
- Different lots used different field assumptions
- Real schema may have `documentId` instead of `targetId`

**Impact**: Some audit log entries may use inconsistent field names.
**Mitigation**: Verify schema before any new audit logging. Use `accessedById` always.
**When to resolve**: Schema cleanup in a post-freeze migration.
