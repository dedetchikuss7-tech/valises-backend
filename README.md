# Valises Backend

Backend API for the Valises platform, built with NestJS and Prisma.

## Scope

This backend currently covers the main V1 operational backbone:

- authentication with JWT
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

## Project setup

```bash
npm install