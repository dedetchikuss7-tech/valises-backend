-- CreateEnum
CREATE TYPE "CompensationType" AS ENUM ('LOST', 'DAMAGED', 'DELAYED');

-- CreateEnum
CREATE TYPE "CompensationStatus" AS ENUM ('PENDING_REVIEW', 'UNDER_INVESTIGATION', 'APPROVED', 'REJECTED', 'PAID');

-- CreateTable
CREATE TABLE "CompensationRequest" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "type" "CompensationType" NOT NULL,
    "declaredValue" INTEGER,
    "description" TEXT NOT NULL,
    "evidenceUrls" JSONB,
    "status" "CompensationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "adminNotes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedAmount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompensationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompensationRequest_transactionId_idx" ON "CompensationRequest"("transactionId");

-- CreateIndex
CREATE INDEX "CompensationRequest_requestedById_idx" ON "CompensationRequest"("requestedById");

-- CreateIndex
CREATE INDEX "CompensationRequest_status_createdAt_idx" ON "CompensationRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "CompensationRequest" ADD CONSTRAINT "CompensationRequest_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationRequest" ADD CONSTRAINT "CompensationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationRequest" ADD CONSTRAINT "CompensationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
