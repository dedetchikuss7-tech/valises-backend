-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN     "actorUserId" TEXT,
ADD COLUMN     "referenceId" TEXT,
ADD COLUMN     "referenceType" "LedgerReferenceType" NOT NULL DEFAULT 'TRANSACTION',
ADD COLUMN     "source" "LedgerSource" NOT NULL DEFAULT 'SYSTEM';

-- CreateIndex
CREATE INDEX "LedgerEntry_source_idx" ON "LedgerEntry"("source");

-- CreateIndex
CREATE INDEX "LedgerEntry_referenceType_idx" ON "LedgerEntry"("referenceType");
