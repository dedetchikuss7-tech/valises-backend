CREATE TYPE "AdminOwnershipObjectType" AS ENUM (
  'AML',
  'DISPUTE',
  'PAYOUT',
  'REFUND',
  'ABANDONMENT',
  'RECONCILIATION_PAYOUT',
  'RECONCILIATION_REFUND',
  'FINANCIAL_CONTROL',
  'TRANSACTION',
  'ADMIN_CASE'
);

CREATE TYPE "AdminOwnershipOperationalStatus" AS ENUM (
  'NEW',
  'CLAIMED',
  'IN_REVIEW',
  'WAITING_EXTERNAL',
  'DONE',
  'RELEASED'
);

CREATE TABLE "AdminOwnership" (
  "id" TEXT NOT NULL,
  "objectType" "AdminOwnershipObjectType" NOT NULL,
  "objectId" TEXT NOT NULL,
  "assignedAdminId" TEXT,
  "claimedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "operationalStatus" "AdminOwnershipOperationalStatus" NOT NULL DEFAULT 'NEW',
  "slaDueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminOwnership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminOwnership_objectType_objectId_key"
ON "AdminOwnership"("objectType", "objectId");

CREATE INDEX "AdminOwnership_objectType_operationalStatus_idx"
ON "AdminOwnership"("objectType", "operationalStatus");

CREATE INDEX "AdminOwnership_assignedAdminId_operationalStatus_idx"
ON "AdminOwnership"("assignedAdminId", "operationalStatus");

CREATE INDEX "AdminOwnership_slaDueAt_idx"
ON "AdminOwnership"("slaDueAt");

CREATE INDEX "AdminOwnership_createdAt_idx"
ON "AdminOwnership"("createdAt");