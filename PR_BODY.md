## Lot #287 — Document Lifecycle

### What this does
Implements GDPR-aligned data lifecycle management: soft deletion of personal data
with a 30-day grace period, KYC document retention policy (90 days post-verification),
and an audit trail for document access.

### New components
- `DocumentAccessLog` Prisma model: tracks who accessed which KYC document, when, from which endpoint
- `DocumentLifecycleService`: `requestDataDeletion()`, `executeDataDeletion()`, `runKycRetentionCleanup()`, `logDocumentAccess()`, `getDocumentAccessLogs()`
- `DocumentLifecycleScheduler`: nightly batch at 3AM (deletion execution) and 4AM (KYC retention cleanup)
- `DocumentLifecycleModule` registered in AppModule

### User endpoint
- `DELETE /me/data` — initiates soft delete, sets `deletionStatus: DELETION_PENDING`, grace period 30 days

### Admin endpoint
- `GET /admin/document-access-logs/:userId` — audit trail of document accesses

### What is NOT deleted
Ledger entries, transactions, payouts, disputes — retained for regulatory compliance.

### What is anonymized
Email → `deleted_{userId}@deleted.invalid`.

### KYC retention
S3 documents in `kyc/` are deleted 90 days after verification if the related
transaction is DELIVERED or CANCELLED. Scaffolded and ready to activate once
StorageProvider exposes a `deleteFile()` method.

### Schema adaptations vs. spec
- User model has no `firstName`/`lastName` fields — only email is anonymized
- No standalone `KycDocument` model — KYC data tracked via `KycVerification`; S3 cleanup scaffolded
- `JwtAuthGuard` and `RolesGuard` are globally registered in AppModule — no `@UseGuards` needed in controller
- `req.user.userId` used (from JWT strategy `validate()`) rather than `req.user.sub`

### Tests
11 new unit tests. Total: 916.
