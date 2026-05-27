# Valises — Financial Source of Truth

> Last verified: lot #298

This document defines which table/model is authoritative for each type of financial data in the Valises system.

## Source of truth by data type

| Data type | Authoritative model | Key fields | Notes |
|---|---|---|---|
| Transaction amount | `Transaction` | `amount`, `status`, `paymentStatus` | All amounts in XAF centimes (Int) |
| Escrow balance | `LedgerEntry` | `amount`, `type`, `idempotencyKey` | Append-only — never update or delete |
| Commission | `LedgerEntry` | `type = COMMISSION_ACCRUAL` | Commission entries alongside escrow entries |
| Payment PSP trace | `PaymentAttempt` | `pspReference`, `status`, `attemptOrigin` | One row per PSP call, including retries |
| Payout to traveler | `Payout` | `amount`, `status`, `eligibleAt` | Status: READY → REQUESTED → PROCESSING → PAID |
| Refund | `Refund` | `amount`, `status`, `idempotencyKey` | Linked to transaction via transactionId |
| Dispute | `Dispute` | `status`, `resolution`, `slaDeadline` | One dispute per transaction max |
| Reconciliation | `ReconciliationCase` | `discrepancyType`, `severity`, `resolvedAt` | Created by reconciliation runs |
| Compensation | `CompensationRequest` | `status`, `approvedAmount`, `type` | Manual admin review only — "Protection Valises" |
| Fraud signal | `FraudFlag` | `type`, `severity`, `resolvedAt` | `resolvedAt = null` means active flag |

## Ledger entry types

| Type | Meaning |
|---|---|
| `ESCROW_CREDIT` | Funds locked from sender payment |
| `ESCROW_DEBIT_RELEASE` | Funds released to traveler on delivery |
| `ESCROW_DEBIT_REFUND` | Funds returned to sender via refund |
| `COMMISSION_ACCRUAL` | Platform commission deducted |
| `COMMISSION_REVERSAL` | Commission reversed (e.g. on dispute) |
| `RESERVE_CREDIT` | Reserve fund credit |
| `RESERVE_DEBIT` | Reserve fund debit |
| `REFERRAL_REWARD` | Referral bonus (reserved) |

## Invariants

1. All monetary amounts are stored as `Int` in XAF centimes — never Float.
2. LedgerEntry rows are append-only with idempotency keys — no updates, no deletes.
3. `PaymentAttempt.pspReference` is the canonical reconciliation key against the PSP.
4. `Transaction.deliveryConfirmedAt` (not `deliveredAt`) is the delivery timestamp.
5. `Trip.carrierId` (not `travelerId`) identifies the traveler on a trip.
6. A transaction's financial state is the aggregate of its LedgerEntry rows — not the Transaction.amount alone.
7. `Payout` is 1:1 with `Transaction` via `transactionId @unique`.
8. `FraudFlag.type`, `.severity`, `.description` are plain strings (not enums) — values set by fraud detection logic.

## Reading a transaction's financial state

To reconstruct the full financial state of a transaction:
1. Read `Transaction` for status, amounts, and payment reference
2. Read all `LedgerEntry` rows for the transaction (sum by type)
3. Read `PaymentAttempt` rows for PSP trace
4. Read `Payout` linked via `transactionId` (at most one)
5. Read `Dispute` if any (at most one per transaction)
6. Read `ReconciliationCase` rows linked to this transaction
7. Read `CompensationRequest` rows for this transaction
8. Read active `FraudFlag` rows for sender and traveler (`resolvedAt = null` means active)
