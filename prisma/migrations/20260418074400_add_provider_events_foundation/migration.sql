-- CreateEnum
CREATE TYPE "ProviderEventObjectType" AS ENUM ('PAYOUT', 'REFUND');

-- CreateEnum
CREATE TYPE "ProviderEventProcessingStatus" AS ENUM ('RECEIVED', 'APPLIED', 'IGNORED', 'FAILED');

-- CreateTable
CREATE TABLE "ProviderEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "objectType" "ProviderEventObjectType" NOT NULL,
    "eventType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "objectReference" TEXT,
    "externalReference" TEXT,
    "transactionId" TEXT,
    "payoutId" TEXT,
    "refundId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "processingStatus" "ProviderEventProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB,
    "failureReason" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderEvent_idempotencyKey_key" ON "ProviderEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProviderEvent_provider_objectType_eventType_idx" ON "ProviderEvent"("provider", "objectType", "eventType");

-- CreateIndex
CREATE INDEX "ProviderEvent_transactionId_occurredAt_idx" ON "ProviderEvent"("transactionId", "occurredAt");

-- CreateIndex
CREATE INDEX "ProviderEvent_payoutId_occurredAt_idx" ON "ProviderEvent"("payoutId", "occurredAt");

-- CreateIndex
CREATE INDEX "ProviderEvent_refundId_occurredAt_idx" ON "ProviderEvent"("refundId", "occurredAt");

-- CreateIndex
CREATE INDEX "ProviderEvent_processingStatus_occurredAt_idx" ON "ProviderEvent"("processingStatus", "occurredAt");

-- AddForeignKey
ALTER TABLE "ProviderEvent" ADD CONSTRAINT "ProviderEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEvent" ADD CONSTRAINT "ProviderEvent_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEvent" ADD CONSTRAINT "ProviderEvent_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;
