## Lot #291 — Notification Delivery Wiring

### What this does
Wires the notification outbox for 5 key events. Notifications are inserted
with idempotency guarantees and processed by a nightly scheduler.
Real email/push sending is intentionally deferred — this lot establishes
the plumbing and logs delivery for now.

### 5 wired events
- `TRANSACTION_CREATED`
- `PAYMENT_CONFIRMED`
- `DELIVERY_CONFIRMED`
- `DISPUTE_OPENED`
- `PAYOUT_PAID`

### Idempotency
Key format: `notification:{eventType}:{entityId}` — stored in `metadata->>'idempotency_key'`.
Duplicate events are silently skipped without hitting the insert path.

### New components
- `NotificationOutboxService`: `enqueue()`, `processPendingBatch()`, `getDeadLetterQueue()`
- `NotificationOutboxScheduler`: processes pending batch every minute via `@Cron`
- `notification-templates.ts`: minimal French text templates (no HTML)
- `notification-events.ts`: event type constants and payload interface
- Feature flag: `NOTIFICATIONS_ENABLED=false` (default off)

### Schema adaptation
`notification_outbox` is a raw SQL table — no Prisma model added.
Real columns used: `recipient_user_id`, `attempt_count`, `payload` JSONB,
`channel` (IN_APP default), `template_key`, `metadata` (carries idempotency key).

### DLQ behavior
After `MAX_ATTEMPTS = 2` failures, notification moves to `status: FAILED` (dead letter queue).
`getDeadLetterQueue()` returns last 100 failed rows.

### No schema changes
All existing `NotificationsService` endpoints and tests untouched.
`ScheduleModule` already imported in `AppModule` — not re-imported.

### Tests
10 new unit tests. Total: 951.
