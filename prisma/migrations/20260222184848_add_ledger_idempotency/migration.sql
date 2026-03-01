/*
  Warnings:

  - A unique constraint covering the columns `[transactionId,idempotencyKey]` on the table `LedgerEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_transactionId_idempotencyKey_key" ON "LedgerEntry"("transactionId", "idempotencyKey");
