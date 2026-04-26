ALTER TABLE "Trip"
ADD COLUMN "flightTicketRef" TEXT,
ADD COLUMN "flightTicketFileName" TEXT,
ADD COLUMN "flightTicketMimeType" TEXT,
ADD COLUMN "flightTicketSizeBytes" INTEGER,
ADD COLUMN "flightTicketProvider" TEXT,
ADD COLUMN "flightTicketProviderUploadId" TEXT,
ADD COLUMN "flightTicketStorageKey" TEXT,
ADD COLUMN "flightTicketObjectUrl" TEXT,
ADD COLUMN "flightTicketPublicUrl" TEXT,
ADD COLUMN "flightTicketSubmittedAt" TIMESTAMP(3),
ADD COLUMN "flightTicketSubmittedById" TEXT,
ADD COLUMN "flightTicketRejectionReason" TEXT,
ADD COLUMN "flightTicketReviewNotes" TEXT;

CREATE INDEX "Trip_flightTicketSubmittedAt_idx" ON "Trip"("flightTicketSubmittedAt");
CREATE INDEX "Trip_flightTicketSubmittedById_idx" ON "Trip"("flightTicketSubmittedById");