-- CreateEnum
CREATE TYPE "RefundProvider" AS ENUM ('MANUAL', 'MOCK_STRIPE');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('READY', 'REQUESTED', 'PROCESSING', 'REFUNDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "provider" "RefundProvider" NOT NULL DEFAULT 'MANUAL',
    "status" "RefundStatus" NOT NULL DEFAULT 'READY',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "idempotencyKey" TEXT NOT NULL,
    "externalReference" TEXT,
    "failureReason" TEXT,
    "metadata" JSONB,
    "requestedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Refund_transactionId_key" ON "Refund"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Refund_status_provider_idx" ON "Refund"("status", "provider");

-- CreateIndex
CREATE INDEX "Refund_transactionId_idx" ON "Refund"("transactionId");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
