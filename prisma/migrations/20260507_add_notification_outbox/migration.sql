CREATE TABLE "notification_outbox" (
  "id" TEXT NOT NULL,
  "recipient_user_id" TEXT,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "template_key" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "target_type" TEXT,
  "target_id" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB,
  "scheduled_for" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "failure_reason" TEXT,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_outbox_channel_check" CHECK ("channel" IN ('IN_APP', 'EMAIL', 'SMS', 'PUSH')),
  CONSTRAINT "notification_outbox_status_check" CHECK ("status" IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED'))
);

CREATE INDEX "notification_outbox_recipient_status_created_idx"
  ON "notification_outbox" ("recipient_user_id", "status", "created_at");

CREATE INDEX "notification_outbox_status_scheduled_idx"
  ON "notification_outbox" ("status", "scheduled_for");

CREATE INDEX "notification_outbox_target_idx"
  ON "notification_outbox" ("target_type", "target_id");

CREATE INDEX "notification_outbox_event_type_created_idx"
  ON "notification_outbox" ("event_type", "created_at");