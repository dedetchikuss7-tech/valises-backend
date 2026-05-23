-- Lot #267: Fraud & Abuse Prevention Foundation
-- Creates the FraudFlag table for velocity checks, suspicious flags, and payout cooldown tracking

CREATE TABLE "FraudFlag" (
    "id"          TEXT         NOT NULL,
    "userId"      TEXT         NOT NULL,
    "type"        TEXT         NOT NULL,
    "severity"    TEXT         NOT NULL,
    "description" TEXT         NOT NULL,
    "metadata"    JSONB,
    "resolvedAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FraudFlag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FraudFlag_userId_createdAt_idx" ON "FraudFlag"("userId", "createdAt");

ALTER TABLE "FraudFlag"
    ADD CONSTRAINT "FraudFlag_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
