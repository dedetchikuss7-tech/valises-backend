-- AlterTable: Transaction - add financial snapshot fields
ALTER TABLE "Transaction" ADD COLUMN "platformRevenue" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Transaction" ADD COLUMN "pricingSnapshotJson" JSONB;

-- AlterTable: Payout - add manual approval fields
ALTER TABLE "Payout" ADD COLUMN "requiresManualApproval" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Payout" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "Payout" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Payout" ADD COLUMN "approvalNotes" TEXT;
