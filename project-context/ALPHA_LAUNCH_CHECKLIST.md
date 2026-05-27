# Valises — Alpha Launch Checklist

> To be completed by the team before opening to first users.
> Run `scripts/pre-launch-check.sh` and `GET /admin/readiness` first.
> All FAIL items must be resolved. WARN items require a conscious decision.

---

## Infrastructure

- [ ] Railway project created and linked to the `main` branch (not `develop`)
- [ ] PostgreSQL 15 provisioned on Railway (or external managed DB)
- [ ] All required env vars set in Railway dashboard (see list below)
- [ ] `npx prisma migrate deploy` run successfully against production DB
- [ ] `npx prisma db seed` run — production corridors present
- [ ] At least one ADMIN user created in production DB

## Environment variables (production)

- [ ] `DATABASE_URL` — production PostgreSQL connection string
- [ ] `JWT_SECRET` — strong random secret (min 32 chars), not reused from dev
- [ ] `PAYMENT_PROVIDER=CINETPAY`
- [ ] `CINETPAY_API_KEY` — production key (not sandbox)
- [ ] `CINETPAY_SITE_ID` — production site ID
- [ ] `STORAGE_PROVIDER=S3`
- [ ] `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_S3_BUCKET` + `AWS_REGION`
- [ ] `SENDGRID_API_KEY` — production key
- [ ] `NOTIFICATIONS_ENABLED=false` (keep off until email provider is validated end-to-end)
- [ ] `WEBHOOK_ASYNC_ENABLED=false` (keep synchronous until Redis is validated)
- [ ] `PROVIDER_WEBHOOK_SECRET_CINETPAY` — set to match CinetPay webhook config
- [ ] `SENTRY_DSN` (optional but recommended for alpha)

## Security

- [ ] CORS origins restricted to production FlutterFlow domains only
- [ ] JWT_SECRET rotated from any value used in staging/dev
- [ ] Admin account uses a strong password, not a shared default
- [ ] Swagger UI (`/docs`) disabled or access-restricted in production
- [ ] S3 bucket is private (no public ACL)
- [ ] CinetPay webhook HMAC verification active (`PROVIDER_WEBHOOK_SECRET_CINETPAY` set)

## Functional validation

- [ ] End-to-end transaction flow tested in production env (create → pay → confirm delivery)
- [ ] CinetPay sandbox replaced by production credentials and a real test transaction completed
- [ ] KYC verification flow tested with Smile ID production (or kept in sandbox for alpha)
- [ ] Payout flow tested: traveler receives funds after delivery
- [ ] Dispute flow tested: admin can open, review, and resolve
- [ ] Admin can suspend and ban a user
- [ ] Financial audit endpoint returns correct data for a real transaction
- [ ] `GET /admin/readiness` returns `overall: "READY"`

## Monitoring

- [ ] Sentry project created and DSN configured
- [ ] Railway health check configured (pointing to `GET /ops/readyz` or equivalent)
- [ ] Database backup strategy confirmed (Railway automatic backups or pg_dump cron)
- [ ] On-call runbooks reviewed: `project-context/runbooks/`

## Go / No-Go decision

Before opening to users:
- All FAIL items resolved
- All security items checked
- At least one full E2E transaction completed in production
- At least one admin user confirmed working
- `GET /admin/readiness` returns `overall: "READY"`
