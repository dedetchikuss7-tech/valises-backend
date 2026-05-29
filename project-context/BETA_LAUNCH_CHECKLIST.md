# BETA_LAUNCH_CHECKLIST.md

> Created: 2026-05-29 | Lot #320
> Use this checklist before opening Valises to beta users.

---

## Pre-requisites

- [ ] `BACKEND_FREEZE_CRITERIA.md` — all 7 criteria checked
- [ ] `GET /admin/readiness` returns `READY` or `READY_WITH_WARNINGS` in staging
- [ ] `scripts/pre-launch-check.sh` passes in staging environment

---

## Infrastructure

- [ ] Railway production environment deployed
- [ ] PostgreSQL production database provisioned and migrated
- [ ] Redis production instance running (BullMQ)
- [ ] S3 production bucket configured (private, versioning enabled)
- [ ] Environment variables set for production (see below)

---

## Required Production Environment Variables

```
DATABASE_URL=
REDIS_URL=
JWT_SECRET=                    # min 32 chars, random
JWT_EXPIRES_IN=15m
PAYMENT_PROVIDER=CINETPAY
CINETPAY_API_KEY=
CINETPAY_SITE_ID=
PROVIDER_WEBHOOK_SECRET_CINETPAY=
WEBHOOK_REPLAY_WINDOW_SECONDS=300
STORAGE_PROVIDER=S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_REGION=
EMAIL_PROVIDER=SENDGRID
SENDGRID_API_KEY=
EMAIL_FROM_ADDRESS=noreply@valises.app
EMAIL_FROM_NAME=Valises
EMAIL_UNSUBSCRIBE_SECRET=      # min 32 chars, random
PUSH_PROVIDER=FCM
FCM_SERVER_KEY=
KYC_PROVIDER=SMILE_ID
SMILE_ID_API_KEY=
SMILE_ID_PARTNER_ID=
LOG_LEVEL=warn
NOTIFICATIONS_ENABLED=true
CORS_ALLOW_FLUTTERFLOW=true
```

---

## Email & Notifications

- [ ] SPF record added for valises.app
- [ ] DKIM CNAME records added and verified in SendGrid
- [ ] DMARC record added (`p=quarantine`)
- [ ] SendGrid sender domain verified
- [ ] Test email sent and received successfully
- [ ] FCM server key valid — test push notification received on device

---

## Security

- [ ] `SECURITY_AUDIT.md` reviewed — all controllers #300–#319 audited
- [ ] JWT_SECRET is production-grade random (not dev default)
- [ ] Webhook secret configured and tested
- [ ] S3 bucket is private (no public access)
- [ ] CORS configured for production FlutterFlow domain

---

## Operations

- [ ] At least 1 active corridor seeded in production
- [ ] Admin user created in production
- [ ] `GET /admin/readiness` tested from production
- [ ] `GET /admin/operational-health` tested from production
- [ ] Runbooks reviewed by ops team (`project-context/runbooks/`)
- [ ] Dispute escalation path defined (who handles disputes?)
- [ ] KYC override process defined (who approves edge cases?)
- [ ] Payout approval process defined (who approves payouts?)

---

## FlutterFlow

- [ ] Production API base URL configured in FlutterFlow
- [ ] Authentication flow tested end-to-end
- [ ] Transaction creation flow tested on real device
- [ ] Delivery confirmation flow tested on real device
- [ ] At least 1 complete transaction (creation → payment → delivery) in staging

---

## Legal

- [ ] Privacy Policy published at accessible URL
- [ ] Terms of Service published
- [ ] GDPR/data export endpoint tested
- [ ] Compensation Policy communicated to users (Protection Valises, 50k XAF cap)

---

## Final Verification

- [ ] `scripts/pre-launch-check.sh` passes on production environment
- [ ] No open CRITICAL items in `KNOWN_LIMITATIONS.md`
- [ ] Beta user onboarding plan defined
- [ ] Support contact accessible (email or WhatsApp)

---

## Commit Hash at Beta

> Record here: _______________
> Date: _______________
> Verified by: _______________
