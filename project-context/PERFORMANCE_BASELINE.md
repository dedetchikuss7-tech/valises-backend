# Performance Baseline — Valises Backend

> Last updated: 2026-05-29 | Lot #318

## Scope

Targeted audit on 3 critical endpoints. No generalized micro-optimization.

## Prisma N+1 issues found and fixed

### Transaction list (`TransactionService.listTransactionsForSender`)

**Issue**: None found. Already optimal — cursor-paginated (`take: limit+1`), targeted `select` (no `select *`), corridor loaded via nested `select` in the same query.

**Note**: The generic `findAll()` admin endpoint has no `take` limit. Acceptable for alpha with small data volumes — add cursor pagination if admin transaction list becomes slow pre-beta.

### Matching (`MatchingService.listTripCandidatesForPackage`)

**Issue**: **N+1 confirmed** — `buildCandidate()` was called per trip via `Promise.all()`, making 3 DB queries per trip:
- `userTrustProfile.findUnique` (trust profile)
- `behaviorRestriction.findMany` (active restrictions)
- `user.findUnique` (carrier stats)

With up to 200 trips, this was up to **600 queries per matching request**.

**Fix**: Extracted all carrier IDs before the loop. Replaced 3-per-trip queries with 3 batch queries using `{ in: carrierIds }`. Built lookup Maps and passed pre-fetched data to a synchronous `buildCandidate()`. Comment: `// PERF: batch-fetch all carrier data in 3 queries instead of 3 per trip (N+1 fix)`

### Trust profile (`TrustService.getTrustProfile`)

**Issue**: 2 sequential queries — `user.findUnique` then `ensureProfile()` (which itself calls `userTrustProfile.findUnique`). 2 round-trips for every trust profile read.

**Fix**: Single `user.findUnique` with nested `trustProfile` include covers both in one round-trip. Falls back to `userTrustProfile.create` only when profile doesn't exist (rare). Comment: `// PERF: single query fetching user stats + trust profile instead of 2 sequential queries`

## Slow query monitoring

- Prisma `$on('query', ...)` listener logs queries > 500ms via Logger.warn
- In-memory circular buffer: last 100 slow queries (singleton `slowQueryLog`)
- Accessible via: `GET /admin/operational-health/performance/slow-queries` (ADMIN only)
- Buffer resets on server restart — not persistent

## Artillery benchmark

3 scenarios defined in `artillery/performance-baseline.yml`:
1. POST /transactions (creation)
2. POST /transactions/:id/confirm-delivery
3. GET /matching?corridorCode=X

Run: `npx artillery run artillery/performance-baseline.yml`

## Alpha targets (indicative)

| Endpoint | p95 target | p99 target |
|---|---|---|
| GET /transactions | < 300ms | < 500ms |
| GET /matching | < 400ms | < 800ms |
| GET /users/me/trust-profile | < 200ms | < 400ms |

These are targets, not guarantees. Measured against local DB with seed data.

## Known limitations

- Benchmark runs against local DB — production performance will differ
- No load test against real Railway + RDS setup (planned pre-beta)
- Connection pool not tuned for high concurrency yet
- Slow query `$on` listener captures raw SQL — model name is extracted from SQL pattern (approximate)
- Query logging emits an event per query; disable in production if overhead becomes measurable
