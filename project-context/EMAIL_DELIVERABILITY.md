# Email Deliverability — Valises

> This is a DNS/infrastructure checklist, not code. Configure before going live with SendGrid.

## Required DNS records (configure on your domain registrar)

### SPF
```
TXT @ "v=spf1 include:sendgrid.net ~all"
```

### DKIM
SendGrid generates DKIM keys per sender domain. After adding your domain in SendGrid dashboard:
- Add the two CNAME records SendGrid provides
- Verify in SendGrid that authentication is confirmed

### DMARC
```
TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@valises.app; pct=100"
```
Start with `p=quarantine` before moving to `p=reject`.

## SendGrid setup checklist

- [ ] Sender domain verified (valises.app or subdomain)
- [ ] DKIM CNAME records added and verified
- [ ] SPF record added
- [ ] DMARC record added
- [ ] Unsubscribe group configured in SendGrid dashboard
- [ ] Suppression list enabled
- [ ] Dedicated IP requested (when volume > 50k/month)

## Environment variables required for production

```
EMAIL_PROVIDER=SENDGRID
SENDGRID_API_KEY=SG.xxxx
EMAIL_FROM_ADDRESS=noreply@valises.app
EMAIL_FROM_NAME=Valises
EMAIL_UNSUBSCRIBE_SECRET=<random 32+ char string>
```

## CAN-SPAM / CASL compliance

- `List-Unsubscribe` header added on all transactional emails
- One-click unsubscribe endpoint: `GET /unsubscribe?userId=X&token=Y`
- Token is HMAC-SHA256(userId, EMAIL_UNSUBSCRIBE_SECRET) — stateless, no DB lookup needed
- Unsubscribe preference persistence: full implementation in lot #317 (GDPR Data Export)

## Development / staging

Set `EMAIL_PROVIDER=MOCK` — emails are logged, not sent.

## Architecture

The email module (`src/email/`) is independent of the legacy `NotificationsProviderModule`:

| Module | Interface | Transport | Used by |
|---|---|---|---|
| `EmailModule` | `EmailProvider` | native fetch | `NotificationOutboxService` (EMAIL channel) |
| `NotificationsProviderModule` | `NotificationsProvider` | @sendgrid/mail | `NotificationsService.processDueOutbox()` |

The `NotificationOutboxService.enqueue()` creates one `IN_APP` row and one `EMAIL` row per event.
The cron scheduler (`NotificationOutboxScheduler`) calls `processPendingBatch()` every minute.
EMAIL rows are dispatched via `EmailModule` → `SendGridEmailProvider` (fetch-based, no SDK dependency).

## Template keys (lowercase, matching `notification_outbox.template_key`)

| template_key | Event | Subject FR |
|---|---|---|
| `transaction_created` | TRANSACTION_CREATED | Votre demande de livraison a été créée |
| `payment_confirmed` | PAYMENT_CONFIRMED | Paiement confirmé — votre colis est en route |
| `delivery_confirmed` | DELIVERY_CONFIRMED | Livraison confirmée |
| `dispute_opened` | DISPUTE_OPENED | Un litige a été ouvert sur votre transaction |
| `payout_paid` | PAYOUT_PAID | Votre virement a été effectué |
