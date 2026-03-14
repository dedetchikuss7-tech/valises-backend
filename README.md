# Valises Backend

Backend API for the Valises platform, built with NestJS and Prisma.

## Scope

This backend currently covers the main V1 operational backbone:

- authentication with JWT
- public auth register + login
- RBAC / admin protection
- trips and packages
- transactions
- KYC gating
- auditable escrow ledger
- disputes and dispute resolution
- payout abstraction
- refund abstraction
- messaging
- abandonment tracking
- health endpoint
- Swagger API documentation

## Tech stack

- NestJS
- Prisma
- PostgreSQL
- Jest
- Supertest
- Swagger

## Current validated status

The backend is currently validated on the following points:

- build green
- unit/service/controller tests green
- e2e money/dispute flow green
- Windows smoke runner green
- health endpoint checks API + database readiness

Validated commands:

```bash
npm run build
npm test
npm run test:e2e
npm run scenario:win
