-- Lot #268: Operational Backoffice MVP — SupportNote table
CREATE TABLE "SupportNote" (
    "id"         TEXT      NOT NULL,
    "targetType" TEXT      NOT NULL,
    "targetId"   TEXT      NOT NULL,
    "authorId"   TEXT      NOT NULL,
    "content"    TEXT      NOT NULL,
    "isInternal" BOOLEAN   NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportNote_targetType_targetId_idx" ON "SupportNote"("targetType", "targetId");
