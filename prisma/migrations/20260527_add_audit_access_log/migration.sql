-- CreateTable
CREATE TABLE "AuditAccessLog" (
    "id" TEXT NOT NULL,
    "accessedById" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "AuditAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditAccessLog_accessedById_accessedAt_idx" ON "AuditAccessLog"("accessedById", "accessedAt");

-- CreateIndex
CREATE INDEX "AuditAccessLog_targetType_targetId_accessedAt_idx" ON "AuditAccessLog"("targetType", "targetId", "accessedAt");
