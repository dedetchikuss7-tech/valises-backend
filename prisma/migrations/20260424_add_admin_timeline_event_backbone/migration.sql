CREATE TYPE "AdminTimelineObjectType" AS ENUM (
  'AML',
  'DISPUTE',
  'PAYOUT',
  'REFUND',
  'ABANDONMENT',
  'RECONCILIATION_PAYOUT',
  'RECONCILIATION_REFUND',
  'FINANCIAL_CONTROL',
  'TRANSACTION',
  'ADMIN_CASE'
);

CREATE TYPE "AdminTimelineSeverity" AS ENUM (
  'INFO',
  'SUCCESS',
  'WARNING',
  'ERROR'
);

CREATE TABLE "AdminTimelineEvent" (
  "id" TEXT NOT NULL,
  "objectType" "AdminTimelineObjectType" NOT NULL,
  "objectId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT,
  "actorUserId" TEXT,
  "severity" "AdminTimelineSeverity" NOT NULL DEFAULT 'INFO',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminTimelineEvent_objectType_objectId_createdAt_idx"
ON "AdminTimelineEvent"("objectType", "objectId", "createdAt");

CREATE INDEX "AdminTimelineEvent_eventType_createdAt_idx"
ON "AdminTimelineEvent"("eventType", "createdAt");

CREATE INDEX "AdminTimelineEvent_actorUserId_createdAt_idx"
ON "AdminTimelineEvent"("actorUserId", "createdAt");

CREATE INDEX "AdminTimelineEvent_severity_createdAt_idx"
ON "AdminTimelineEvent"("severity", "createdAt");

CREATE INDEX "AdminTimelineEvent_createdAt_idx"
ON "AdminTimelineEvent"("createdAt");