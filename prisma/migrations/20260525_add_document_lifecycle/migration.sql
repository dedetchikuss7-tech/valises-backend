-- AlterTable: add soft-delete fields to User
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3),
                   ADD COLUMN "deletionStatus" TEXT;

-- CreateTable: DocumentAccessLog
CREATE TABLE "DocumentAccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "accessedBy" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentAccessLog_userId_accessedAt_idx" ON "DocumentAccessLog"("userId", "accessedAt");

-- AddForeignKey
ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
