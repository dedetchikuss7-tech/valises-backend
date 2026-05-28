-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "data_export_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'PENDING',
    "s3Key" TEXT,
    "downloadUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "data_export_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_export_requests_userId_idx" ON "data_export_requests"("userId");

-- AddForeignKey
ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
