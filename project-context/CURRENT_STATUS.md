# CURRENT STATUS — Valises Backend

> Last updated: 2026-05-23 | Branch: feature/271-referral-viral-loops | Lot completed: #271

## What this project is

**Valises** is a peer-to-peer parcel delivery marketplace connecting **senders** (people who need packages transported) with **travelers** (people already making the journey). The backend handles the full lifecycle: matching, pricing, payment escrow, delivery confirmation, dispute resolution, and financial payouts.

## Current state of the system

The backend is **production-architecture-ready**. Core domain flows are implemented and covered by E2E tests. The main gaps remaining are mobile contract refinement, notification delivery, and operational tooling hardening.

### What is fully operational
- Auth (JWT, Passport, rate limiting, CORS hardening)
- User registration + KYC gating for transactions
- Trip and package creation with compliance checks
- Transaction state machine (PENDING → CONFIRMED → IN_TRANSIT → DELIVERED)
- Delivery code generation and confirmation
- Dispute workflow (open, evidence, resolution, outcome)
- Escrow ledger (credits, debits, commission entries, idempotency)
- Payment via CinetPay (sandbox + production config) and MOCK fallback
- Payout workflow (manual approval, mock Stripe)
- Refund workflow (manual approval)
- Webhook ingestion and normalization (CinetPay, provider events)
- AML screening and case management
- Message moderation with sanitization and block events
- Trust profiles and reputation scoring
- Review system (post-transaction reviews, rating aggregation)
- Trust score enriched with badges (VERIFIED_TRAVELER, EXPERIENCED, TRUSTED) and reliabilityScore
- Fraud & abuse prevention (velocity checks, payout cooldown, FraudFlag model, admin flag resolution)
- Operational backoffice: support notes (SupportNote model), transaction search, full transaction support view, webhook resend
- Dispute SLA workflow: slaDeadline (createdAt+72h), escalation tracking, payout hold flag, resolution templates (REFUND_FULL/PARTIAL, RELEASE_TRAVELER, NO_ACTION)
- Matching Intelligence V1: matchScore 0-100 (KYC/rating/deliveries/corridor/penalty), travelerTrustBadges, isRecommended on candidates and shortlist; default sort by matchScore desc
- Referral & Viral Loops: ReferralCode (unique per user, 8-char alphanum), ReferralUse (anti-abuse, one per referred user), GET /referral/my-code, POST /referral/apply, GET /referral/my-referrals; grantReward marks rewardGranted; REFERRAL_REWARD ledger type reserved
- Admin modules: ownership, workload, reconciliation, ledger integrity, timeline
- Sentry integration (optional, env-gated)
- Swagger auto-docs (`/docs`)
- CI pipeline (GitHub Actions, PostgreSQL 15, Node 20)
- Production corridor seeds

### What is in progress / planned
- Notifications delivery (email, push — providers abstracted, not wired)
- Admin dashboard summary completeness
- Storage provider wiring (currently MOCK_STORAGE; S3/Cloudinary reserved)
- CORS wildcard support for FlutterFlow web apps (currently exact-match only)

## Active branch conventions

| Prefix | Purpose |
|---|---|
| `feature/NNN-slug` | Lot implementation |
| `fix/NNN-slug` | Bug fix tied to a lot |
| `chore/slug` | Non-functional (deps, docs, CI) |

## Environment modes

| Mode | PAYMENT_PROVIDER | STORAGE_PROVIDER | Notes |
|---|---|---|---|
| Development | MOCK | MOCK_STORAGE | No external deps |
| Staging | CINETPAY | MOCK_STORAGE | CinetPay sandbox |
| Production | CINETPAY | TBD | Real keys required |

## Key invariants (do not break)

1. All monetary amounts use `Decimal(12,2)` — never `Float`
2. Ledger entries are append-only with idempotency keys
3. Delivery code confirmation is the only gateway to DELIVERED state
4. KYC must be VERIFIED before a sender can create a transaction
5. Admin endpoints require `ADMIN` role; user endpoints require `USER` role
6. E2E tests run with `maxWorkers: 1` (sequential) — do not change
7. Never skip `prisma migrate deploy` in CI; never use `db push` in production

## Lot history (last 10)

| Lot | Branch | Summary |
|---|---|---|
| #271 | feature/271-referral-viral-loops | ReferralCode + ReferralUse models, 3 endpoints (my-code/apply/my-referrals), grantReward, REFERRAL_REWARD enum |
| #270 | feature/270-matching-intelligence | matchScore 0-100, travelerTrustBadges, isRecommended on candidates + shortlist, sort by matchScore |
| #269 | feature/269-dispute-resolution-workflow | SLA timers (slaDeadline=createdAt+72h), escalation, payout hold, partial refund, resolution templates, 4 admin endpoints |
| #268 | feature/268-operational-backoffice-mvp | SupportNote model, admin-support endpoints: add/list notes, transaction search, full support view, webhook resend |
| #267 | feature/267-fraud-prevention | FraudFlag model, velocity check (>5 tx/24h), payout cooldown (6h), flagUser/getActiveFlags/resolveFlag, admin endpoints |
| #266 | feature/266-reputation-trust-system | Review model, POST /reviews, GET /reviews/me, GET /reviews/user/:id, getTrustProfile with badges & reliabilityScore |
| #265 | feature/265-flutterflow-mvp-connect | FlutterFlow integration guide, 20-endpoint validation script, mobile contract corridor UUID fix |
| #264 | feature/264a-context-engineering | Context engineering foundation (CURRENT_STATUS, ARCHITECTURE, DECISIONS, KNOWN_TRAPS) |
| #263 | feature/263-production-seed-security-cors | Production corridor seeds, security headers, CORS hardening |
| #262 | feature/262-commission-financial-snapshot-payout | Commission persistence, financial snapshot, manual payout approval |
| #261 | feature/261-webhooks-sentry-jwt | CinetPay webhooks, Sentry integration, JWT hardening |
| #260 | feature/260-cinetpay-sandbox-config | CinetPay sandbox/production config |
| #258 | feature/258-e2e-mvp-test | MVP E2E test script |
| #257 | feature/257-env-validation-psp | PSP env validation with conditional Joi rules |
| #256 | feature/256-psp-foundation | PSP foundation with CinetPay + Mock providers |
| #253 | feat/253-unified-operational-timeline-v2 | Unified operational timeline v2 |
| #252 | feat/252-delivery-proof-orchestration | Delivery proof orchestration |
| #251 | feat/251-dispute-operational-orchestration-v2 | Dispute operational orchestration v2 |

## How to run locally

```bash
npm run start:dev        # Dev server with watch
npm test                 # Unit tests
npm run test:e2e         # E2E tests (requires local Postgres)
npx prisma studio        # Browse database
```

## Files to check before starting a new lot

- `prisma/schema.prisma` — current data model
- `src/app.module.ts` — registered modules
- `project-context/DECISIONS.md` — rationale behind key choices
- `project-context/KNOWN_TRAPS.md` — pitfalls to avoid
- `project-context/lots/LOT_NNN.md` — previous lot spec for context
