## Lot #299 — Alpha Readiness

### What is implemented

- **`scripts/pre-launch-check.sh`** — bash pre-launch script with 7 checks: required env vars, database migrations, CinetPay PSP connectivity, S3 connectivity, SendGrid, corridor seeds, and admin user presence. Exits 0 if READY, 1 if any FAIL.

- **`GET /admin/readiness`** — admin-only JSON endpoint returning `overall: "READY" | "NOT_READY"` with a `checks[]` array of per-check results (name, status OK/WARN/FAIL, message). Checks run in parallel. WARN does not fail overall readiness; only FAIL does.

- **`project-context/ALPHA_LAUNCH_CHECKLIST.md`** — human-readable checklist covering infrastructure, env vars, security, functional validation, and monitoring. Go/No-Go criteria included.

- **`project-context/CURRENT_STATUS.md`** — updated: lot #299 recorded, roadmap marked complete.

### Technical decisions

- The existing `ReadinessController` at `/ops/healthz` and `/ops/readyz` is preserved. The new admin endpoint is `AdminReadinessController` in `admin-readiness.controller.ts` — same module, separate class.
- `ReadinessService` runs all 8 checks in `Promise.all` for minimal latency. Each check is isolated with graceful degradation.
- No Prisma migration required — reads existing `Corridor`, `User`, and `_prisma_migrations` tables.

### Tests

8 unit tests: READY when all pass, NOT_READY on DB unreachable / no corridors / no admin user, WARN on MOCK providers (non-blocking), FAIL when CinetPay keys missing, checkedAt always present.

### Invariants respected

- Global guards only — no `@UseGuards()` in controller
- No ScheduleModule re-import
- No new Prisma models, no monetary Float
