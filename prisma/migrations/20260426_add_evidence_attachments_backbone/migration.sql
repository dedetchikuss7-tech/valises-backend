CREATE TYPE "EvidenceAttachmentObjectType" AS ENUM (
  'PACKAGE',
  'TRANSACTION',
  'DISPUTE',
  'DELIVERY',
  'REFUND',
  'PAYOUT',
  'ADMIN_CASE',
  'KYC',
  'OTHER'
);

CREATE TYPE "EvidenceAttachmentType" AS ENUM (
  'PACKAGE_PHOTO',
  'HANDOVER_NOTE',
  'DELIVERY_PROOF',
  'SCREENSHOT',
  'DOCUMENT',
  'REFUND_PROOF',
  'PAYOUT_PROOF',
  'DISPUTE_EVIDENCE',
  'ADMIN_NOTE_ATTACHMENT',
  'OTHER'
);

CREATE TYPE "EvidenceAttachmentStatus" AS ENUM (
  'PENDING_REVIEW',
  'ACCEPTED',
  'REJECTED'
);

CREATE TYPE "EvidenceAttachmentVisibility" AS ENUM (
  'ADMIN_ONLY',
  'OWNER_ONLY',
  'PARTIES'
);

CREATE TABLE "EvidenceAttachment" (
  "id" TEXT NOT NULL,
  "targetType" "EvidenceAttachmentObjectType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "attachmentType" "EvidenceAttachmentType" NOT NULL,
  "status" "EvidenceAttachmentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "visibility" "EvidenceAttachmentVisibility" NOT NULL DEFAULT 'ADMIN_ONLY',
  "uploadedById" TEXT NOT NULL,
  "reviewedByAdminId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "label" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "storageKey" TEXT,
  "fileName" TEXT,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "rejectionReason" TEXT,
  "reviewNotes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EvidenceAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EvidenceAttachment_targetType_targetId_createdAt_idx"
  ON "EvidenceAttachment"("targetType", "targetId", "createdAt");

CREATE INDEX "EvidenceAttachment_uploadedById_createdAt_idx"
  ON "EvidenceAttachment"("uploadedById", "createdAt");

CREATE INDEX "EvidenceAttachment_reviewedByAdminId_reviewedAt_idx"
  ON "EvidenceAttachment"("reviewedByAdminId", "reviewedAt");

CREATE INDEX "EvidenceAttachment_status_createdAt_idx"
  ON "EvidenceAttachment"("status", "createdAt");

CREATE INDEX "EvidenceAttachment_attachmentType_createdAt_idx"
  ON "EvidenceAttachment"("attachmentType", "createdAt");

CREATE INDEX "EvidenceAttachment_visibility_createdAt_idx"
  ON "EvidenceAttachment"("visibility", "createdAt");