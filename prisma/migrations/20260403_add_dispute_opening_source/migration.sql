CREATE TYPE "DisputeOpeningSource" AS ENUM (
  'MANUAL',
  'POST_DEPARTURE_BLOCK_SENDER',
  'POST_DEPARTURE_BLOCK_TRAVELER'
);

ALTER TABLE "Dispute"
ADD COLUMN "openingSource" "DisputeOpeningSource" NOT NULL DEFAULT 'MANUAL';

CREATE INDEX "Dispute_openingSource_idx" ON "Dispute"("openingSource");