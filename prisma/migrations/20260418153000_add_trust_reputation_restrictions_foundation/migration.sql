-- CreateEnum
CREATE TYPE "TrustProfileStatus" AS ENUM ('NORMAL', 'UNDER_REVIEW', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "ReputationEventKind" AS ENUM (
  'POSITIVE_DELIVERY_CONFIRMED',
  'POSITIVE_SUCCESSFUL_COMPLETION',
  'NEGATIVE_DISPUTE_OPENED',
  'NEGATIVE_MESSAGE_BLOCKED',
  'NEGATIVE_AML_REVIEW',
  'NEGATIVE_AML_BLOCK',
  'NEGATIVE_CANCELLATION_AFTER_PAYMENT',
  'MANUAL_ADJUSTMENT'
);

-- CreateEnum
CREATE TYPE "BehaviorRestrictionKind" AS ENUM (
  'WARNING_ONLY',
  'LIMIT_TRANSACTIONS',
  'BLOCK_PUBLISHING',
  'BLOCK_MESSAGING',
  'BLOCK_ACCOUNT'
);

-- CreateEnum
CREATE TYPE "BehaviorRestrictionStatus" AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BehaviorRestrictionScope" AS ENUM (
  'GLOBAL',
  'TRIPS',
  'PACKAGES',
  'TRANSACTIONS',
  'MESSAGING'
);

-- CreateTable
CREATE TABLE "UserTrustProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 100,
    "status" "TrustProfileStatus" NOT NULL DEFAULT 'NORMAL',
    "totalEvents" INTEGER NOT NULL DEFAULT 0,
    "positiveEvents" INTEGER NOT NULL DEFAULT 0,
    "negativeEvents" INTEGER NOT NULL DEFAULT 0,
    "activeRestrictionCount" INTEGER NOT NULL DEFAULT 0,
    "lastEventAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTrustProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReputationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "kind" "ReputationEventKind" NOT NULL,
    "scoreDelta" INTEGER NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "reasonSummary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviorRestriction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "BehaviorRestrictionKind" NOT NULL,
    "scope" "BehaviorRestrictionScope" NOT NULL DEFAULT 'GLOBAL',
    "status" "BehaviorRestrictionStatus" NOT NULL DEFAULT 'ACTIVE',
    "reasonCode" TEXT NOT NULL,
    "reasonSummary" TEXT,
    "metadata" JSONB,
    "imposedById" TEXT,
    "releasedById" TEXT,
    "imposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BehaviorRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserTrustProfile_userId_key" ON "UserTrustProfile"("userId");

-- CreateIndex
CREATE INDEX "UserTrustProfile_status_score_idx" ON "UserTrustProfile"("status", "score");

-- CreateIndex
CREATE INDEX "UserTrustProfile_lastEventAt_idx" ON "UserTrustProfile"("lastEventAt");

-- CreateIndex
CREATE INDEX "ReputationEvent_userId_createdAt_idx" ON "ReputationEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReputationEvent_kind_createdAt_idx" ON "ReputationEvent"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "ReputationEvent_transactionId_createdAt_idx" ON "ReputationEvent"("transactionId", "createdAt");

-- CreateIndex
CREATE INDEX "BehaviorRestriction_userId_status_scope_idx" ON "BehaviorRestriction"("userId", "status", "scope");

-- CreateIndex
CREATE INDEX "BehaviorRestriction_kind_status_idx" ON "BehaviorRestriction"("kind", "status");

-- CreateIndex
CREATE INDEX "BehaviorRestriction_expiresAt_idx" ON "BehaviorRestriction"("expiresAt");

-- AddForeignKey
ALTER TABLE "UserTrustProfile"
ADD CONSTRAINT "UserTrustProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationEvent"
ADD CONSTRAINT "ReputationEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationEvent"
ADD CONSTRAINT "ReputationEvent_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorRestriction"
ADD CONSTRAINT "BehaviorRestriction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorRestriction"
ADD CONSTRAINT "BehaviorRestriction_imposedById_fkey"
FOREIGN KEY ("imposedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorRestriction"
ADD CONSTRAINT "BehaviorRestriction_releasedById_fkey"
FOREIGN KEY ("releasedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;