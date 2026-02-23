/*
  Warnings:

  - The values [ESCROW_DEBIT] on the enum `LedgerEntryType` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "DisputeReasonCode" AS ENUM ('NOT_DELIVERED', 'DAMAGED', 'WRONG_ITEM', 'WEIGHT_MISMATCH', 'LATE_DELIVERY', 'NO_SHOW_TRAVELER', 'NO_SHOW_SENDER', 'ILLEGAL_ITEM', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceLevel" AS ENUM ('NONE', 'BASIC', 'STRONG');

-- CreateEnum
CREATE TYPE "DisputeOutcome" AS ENUM ('REFUND_SENDER', 'RELEASE_TO_TRAVELER', 'SPLIT', 'REJECT');

-- AlterEnum
BEGIN;
CREATE TYPE "LedgerEntryType_new" AS ENUM ('ESCROW_CREDIT', 'ESCROW_DEBIT_RELEASE', 'ESCROW_DEBIT_REFUND', 'COMMISSION_ACCRUAL', 'COMMISSION_REVERSAL', 'RESERVE_CREDIT', 'RESERVE_DEBIT');
ALTER TABLE "LedgerEntry" ALTER COLUMN "type" TYPE "LedgerEntryType_new" USING ("type"::text::"LedgerEntryType_new");
ALTER TYPE "LedgerEntryType" RENAME TO "LedgerEntryType_old";
ALTER TYPE "LedgerEntryType_new" RENAME TO "LedgerEntryType";
DROP TYPE "public"."LedgerEntryType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "reasonCode" "DisputeReasonCode" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "DisputeResolution" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "outcome" "DisputeOutcome" NOT NULL,
    "evidenceLevel" "EvidenceLevel" NOT NULL DEFAULT 'NONE',
    "refundAmount" INTEGER NOT NULL DEFAULT 0,
    "releaseAmount" INTEGER NOT NULL DEFAULT 0,
    "decidedById" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "matrixVersion" TEXT NOT NULL DEFAULT 'v1',
    "recommendedOutcome" "DisputeOutcome",
    "recommendationNotes" TEXT,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "DisputeResolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DisputeResolution_disputeId_key" ON "DisputeResolution"("disputeId");

-- CreateIndex
CREATE UNIQUE INDEX "DisputeResolution_idempotencyKey_key" ON "DisputeResolution"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DisputeResolution_transactionId_idx" ON "DisputeResolution"("transactionId");

-- CreateIndex
CREATE INDEX "DisputeResolution_outcome_idx" ON "DisputeResolution"("outcome");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- AddForeignKey
ALTER TABLE "DisputeResolution" ADD CONSTRAINT "DisputeResolution_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeResolution" ADD CONSTRAINT "DisputeResolution_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeResolution" ADD CONSTRAINT "DisputeResolution_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
