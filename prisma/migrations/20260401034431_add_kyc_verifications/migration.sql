-- CreateEnum
CREATE TYPE "KycProvider" AS ENUM ('STRIPE_IDENTITY');

-- CreateEnum
CREATE TYPE "KycVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'CANCELED');

-- CreateTable
CREATE TABLE "KycVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "KycProvider" NOT NULL,
    "status" "KycVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "providerSessionId" TEXT NOT NULL,
    "providerStatus" TEXT,
    "providerSessionUrl" TEXT,
    "failureReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KycVerification_providerSessionId_key" ON "KycVerification"("providerSessionId");

-- CreateIndex
CREATE INDEX "KycVerification_userId_createdAt_idx" ON "KycVerification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "KycVerification_status_provider_idx" ON "KycVerification"("status", "provider");

-- AddForeignKey
ALTER TABLE "KycVerification" ADD CONSTRAINT "KycVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
