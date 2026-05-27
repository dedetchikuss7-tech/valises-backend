-- AlterTable
ALTER TABLE "User" ADD COLUMN "kycAttemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "kycRejectionReason" TEXT;
ALTER TABLE "User" ADD COLUMN "kycLastAttemptAt" TIMESTAMP(3);
