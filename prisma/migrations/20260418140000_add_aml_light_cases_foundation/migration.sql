-- CreateEnum
CREATE TYPE "AmlRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AmlDecisionAction" AS ENUM ('ALLOW', 'REQUIRE_REVIEW', 'BLOCK');

-- CreateEnum
CREATE TYPE "AmlCaseStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "AmlCase" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,
    "packageId" TEXT,
    "riskLevel" "AmlRiskLevel" NOT NULL,
    "recommendedAction" "AmlDecisionAction" NOT NULL,
    "currentAction" "AmlDecisionAction" NOT NULL,
    "status" "AmlCaseStatus" NOT NULL DEFAULT 'OPEN',
    "signalCodes" JSONB NOT NULL DEFAULT '[]',
    "signalCount" INTEGER NOT NULL DEFAULT 0,
    "reasonSummary" TEXT,
    "reviewedById" TEXT,
    "reviewNotes" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmlCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AmlCase_transactionId_key" ON "AmlCase"("transactionId");

-- CreateIndex
CREATE INDEX "AmlCase_status_currentAction_idx" ON "AmlCase"("status", "currentAction");

-- CreateIndex
CREATE INDEX "AmlCase_riskLevel_idx" ON "AmlCase"("riskLevel");

-- CreateIndex
CREATE INDEX "AmlCase_openedAt_idx" ON "AmlCase"("openedAt");

-- CreateIndex
CREATE INDEX "AmlCase_senderId_idx" ON "AmlCase"("senderId");

-- CreateIndex
CREATE INDEX "AmlCase_travelerId_idx" ON "AmlCase"("travelerId");

-- CreateIndex
CREATE INDEX "AmlCase_packageId_idx" ON "AmlCase"("packageId");

-- AddForeignKey
ALTER TABLE "AmlCase"
ADD CONSTRAINT "AmlCase_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;