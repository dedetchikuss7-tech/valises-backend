CREATE TYPE "DisputeEvidenceItemKind" AS ENUM (
  'PHOTO',
  'SCREENSHOT',
  'CHAT_EXPORT',
  'TICKET',
  'OTHER'
);

CREATE TYPE "DisputeEvidenceItemStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'REJECTED'
);

CREATE TABLE "DisputeEvidenceItem" (
  "id" TEXT NOT NULL,
  "disputeId" TEXT NOT NULL,
  "kind" "DisputeEvidenceItemKind" NOT NULL,
  "label" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "status" "DisputeEvidenceItemStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedByAdminId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DisputeEvidenceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DisputeEvidenceItem_disputeId_idx" ON "DisputeEvidenceItem"("disputeId");
CREATE INDEX "DisputeEvidenceItem_status_idx" ON "DisputeEvidenceItem"("status");
CREATE INDEX "DisputeEvidenceItem_kind_idx" ON "DisputeEvidenceItem"("kind");
CREATE INDEX "DisputeEvidenceItem_reviewedByAdminId_idx" ON "DisputeEvidenceItem"("reviewedByAdminId");
CREATE INDEX "DisputeEvidenceItem_createdAt_idx" ON "DisputeEvidenceItem"("createdAt");

ALTER TABLE "DisputeEvidenceItem"
ADD CONSTRAINT "DisputeEvidenceItem_disputeId_fkey"
FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DisputeEvidenceItem"
ADD CONSTRAINT "DisputeEvidenceItem_reviewedByAdminId_fkey"
FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;