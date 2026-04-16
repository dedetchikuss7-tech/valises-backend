-- DropForeignKey
ALTER TABLE "DisputeCaseNote" DROP CONSTRAINT "DisputeCaseNote_disputeId_fkey";

-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "handoverDeclaredAt" TIMESTAMP(3),
ADD COLUMN     "handoverDeclaredById" TEXT,
ADD COLUMN     "handoverNotes" TEXT,
ADD COLUMN     "travelerResponsibilityAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "travelerResponsibilityAcknowledgedById" TEXT;

-- CreateIndex
CREATE INDEX "Package_handoverDeclaredAt_idx" ON "Package"("handoverDeclaredAt");

-- CreateIndex
CREATE INDEX "Package_handoverDeclaredById_idx" ON "Package"("handoverDeclaredById");

-- CreateIndex
CREATE INDEX "Package_travelerResponsibilityAcknowledgedAt_idx" ON "Package"("travelerResponsibilityAcknowledgedAt");

-- CreateIndex
CREATE INDEX "Package_travelerResponsibilityAcknowledgedById_idx" ON "Package"("travelerResponsibilityAcknowledgedById");

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_handoverDeclaredById_fkey" FOREIGN KEY ("handoverDeclaredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_travelerResponsibilityAcknowledgedById_fkey" FOREIGN KEY ("travelerResponsibilityAcknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeCaseNote" ADD CONSTRAINT "DisputeCaseNote_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
