-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM (
  'TERMS_OF_SERVICE',
  'PRIVACY_NOTICE',
  'PLATFORM_ROLE_NOTICE',
  'DELIVERY_RISK_NOTICE',
  'PROHIBITED_ITEMS_NOTICE',
  'ESCROW_NOTICE'
);

-- CreateEnum
CREATE TYPE "LegalAcceptanceContext" AS ENUM (
  'GLOBAL',
  'PACKAGE',
  'TRANSACTION'
);

-- CreateTable
CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" "LegalDocumentType" NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "context" "LegalAcceptanceContext" NOT NULL,
    "transactionId" TEXT,
    "packageId" TEXT,
    "metadata" JSONB,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalAcceptance_userId_documentType_acceptedAt_idx"
ON "LegalAcceptance"("userId", "documentType", "acceptedAt");

-- CreateIndex
CREATE INDEX "LegalAcceptance_context_acceptedAt_idx"
ON "LegalAcceptance"("context", "acceptedAt");

-- CreateIndex
CREATE INDEX "LegalAcceptance_transactionId_acceptedAt_idx"
ON "LegalAcceptance"("transactionId", "acceptedAt");

-- CreateIndex
CREATE INDEX "LegalAcceptance_packageId_acceptedAt_idx"
ON "LegalAcceptance"("packageId", "acceptedAt");

-- AddForeignKey
ALTER TABLE "LegalAcceptance"
ADD CONSTRAINT "LegalAcceptance_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptance"
ADD CONSTRAINT "LegalAcceptance_transactionId_fkey"
FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptance"
ADD CONSTRAINT "LegalAcceptance_packageId_fkey"
FOREIGN KEY ("packageId") REFERENCES "Package"("id")
ON DELETE SET NULL ON UPDATE CASCADE;