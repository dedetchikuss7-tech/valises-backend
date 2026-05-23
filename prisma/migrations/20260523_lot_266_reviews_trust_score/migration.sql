-- Lot #266 — Reputation & Trust System
-- Adds Review model and trust counters on User

-- Add trust/reputation counters to User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "deliverySuccessCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cancellationCount"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "disputeCount"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "averageRating"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reviewCount"          INTEGER NOT NULL DEFAULT 0;

-- Create Review table
CREATE TABLE IF NOT EXISTS "Review" (
  "id"            TEXT        NOT NULL,
  "transactionId" TEXT        NOT NULL,
  "reviewerId"    TEXT        NOT NULL,
  "revieweeId"    TEXT        NOT NULL,
  "role"          TEXT        NOT NULL,
  "rating"        INTEGER     NOT NULL,
  "comment"       TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- Unique: one review per reviewer per transaction
ALTER TABLE "Review"
  ADD CONSTRAINT "Review_transactionId_reviewerId_key"
  UNIQUE ("transactionId", "reviewerId");

-- Foreign keys
ALTER TABLE "Review"
  ADD CONSTRAINT "Review_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_revieweeId_fkey"
  FOREIGN KEY ("revieweeId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "Review_transactionId_idx" ON "Review"("transactionId");
CREATE INDEX IF NOT EXISTS "Review_reviewerId_idx"    ON "Review"("reviewerId");
CREATE INDEX IF NOT EXISTS "Review_revieweeId_idx"    ON "Review"("revieweeId");
CREATE INDEX IF NOT EXISTS "Review_createdAt_idx"     ON "Review"("createdAt");
