CREATE TYPE "DisputeEvidenceStatus" AS ENUM (
  'NOT_REVIEWED',
  'IN_REVIEW',
  'REVIEWED'
);

ALTER TABLE "Dispute"
ADD COLUMN "customerStatement" TEXT,
ADD COLUMN "travelerStatement" TEXT,
ADD COLUMN "evidenceSummary" TEXT,
ADD COLUMN "adminAssessment" TEXT,
ADD COLUMN "evidenceStatus" "DisputeEvidenceStatus" NOT NULL DEFAULT 'NOT_REVIEWED';

CREATE TABLE "DisputeCaseNote" (
  "id" TEXT NOT NULL,
  "disputeId" TEXT NOT NULL,
  "authorAdminId" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DisputeCaseNote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DisputeCaseNote"
ADD CONSTRAINT "DisputeCaseNote_disputeId_fkey"
FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DisputeCaseNote"
ADD CONSTRAINT "DisputeCaseNote_authorAdminId_fkey"
FOREIGN KEY ("authorAdminId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Dispute_evidenceStatus_idx" ON "Dispute"("evidenceStatus");
CREATE INDEX "DisputeCaseNote_disputeId_idx" ON "DisputeCaseNote"("disputeId");
CREATE INDEX "DisputeCaseNote_authorAdminId_idx" ON "DisputeCaseNote"("authorAdminId");
CREATE INDEX "DisputeCaseNote_createdAt_idx" ON "DisputeCaseNote"("createdAt");