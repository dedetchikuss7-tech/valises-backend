-- CreateTable
CREATE TABLE "AdminActionAudit" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminActionAudit_action_createdAt_idx" ON "AdminActionAudit"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AdminActionAudit_targetType_targetId_createdAt_idx" ON "AdminActionAudit"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminActionAudit_actorUserId_createdAt_idx" ON "AdminActionAudit"("actorUserId", "createdAt");
