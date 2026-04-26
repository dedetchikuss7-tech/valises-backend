ALTER TABLE "EvidenceAttachment"
ADD COLUMN "provider" TEXT,
ADD COLUMN "providerUploadId" TEXT,
ADD COLUMN "objectUrl" TEXT,
ADD COLUMN "publicUrl" TEXT;

CREATE INDEX "EvidenceAttachment_provider_createdAt_idx" ON "EvidenceAttachment"("provider", "createdAt");
CREATE INDEX "EvidenceAttachment_storageKey_idx" ON "EvidenceAttachment"("storageKey");
CREATE INDEX "EvidenceAttachment_providerUploadId_idx" ON "EvidenceAttachment"("providerUploadId");