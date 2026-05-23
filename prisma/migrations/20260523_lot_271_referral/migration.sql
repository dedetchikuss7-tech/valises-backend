-- Lot #271 — Referral & Viral Loops
-- Adds REFERRAL_REWARD to LedgerEntryType enum, ReferralCode and ReferralUse models

ALTER TYPE "LedgerEntryType" ADD VALUE IF NOT EXISTS 'REFERRAL_REWARD';

CREATE TABLE "ReferralCode" (
    "id"        TEXT NOT NULL,
    "ownerId"   TEXT NOT NULL,
    "code"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralCode_ownerId_key" ON "ReferralCode"("ownerId");
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");
CREATE INDEX "ReferralCode_code_idx" ON "ReferralCode"("code");

CREATE TABLE "ReferralUse" (
    "id"             TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "rewardGranted"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralUse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralUse_referredUserId_key" ON "ReferralUse"("referredUserId");
CREATE INDEX "ReferralUse_referralCodeId_idx" ON "ReferralUse"("referralCodeId");

ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferralUse" ADD CONSTRAINT "ReferralUse_referralCodeId_fkey"
    FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferralUse" ADD CONSTRAINT "ReferralUse_referredUserId_fkey"
    FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
