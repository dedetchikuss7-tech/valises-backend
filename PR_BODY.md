## Lot #292 — Protection Valises (Manual Review Only)

### Summary
Implements the Protection Valises compensation system. Senders can file claims
for lost, damaged, or delayed parcels. All decisions require explicit admin
action — zero automation.

### New Prisma model: CompensationRequest
Fields: `id`, `transactionId`, `requestedById`, `type` (LOST/DAMAGED/DELAYED),
`declaredValue`, `description`, `evidenceUrls`, `status`, `adminNotes`,
`reviewedById`, `reviewedAt`, `approvedAmount`.

Enums: `CompensationType`, `CompensationStatus`.

### Eligibility rules enforced
- Transaction must be `DELIVERED` or `DISPUTED`
- Request must be submitted within 7 days of `deliveryConfirmedAt`
- Only the sender can file — traveler is explicitly blocked (`ForbiddenException`)
- One request per transaction — duplicates rejected
- `declaredValue` and `approvedAmount` capped at `PROTECTION_MAX_AMOUNT_XAF` (default 50,000 XAF)

### User endpoints
- `POST /compensation/request` — file a Protection Valises claim
- `GET /compensation/my-requests` — view own claims

### Admin endpoints
- `GET /admin/compensation/pending` — review queue (PENDING_REVIEW + UNDER_INVESTIGATION)
- `PATCH /admin/compensation/:id/review` — approve, reject, or investigate

### Policy document
`project-context/COMPENSATION_POLICY.md` — explicit anti-arbitrary policy,
defines scope, eligibility, and what is and is not covered.
Terminology: "Protection Valises" only — never "assurance".

### Tests
14 new unit tests. Total: 965.
