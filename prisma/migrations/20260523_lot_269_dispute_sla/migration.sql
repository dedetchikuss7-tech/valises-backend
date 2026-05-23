-- Lot #269: Dispute Resolution Real Workflow
-- Adds SLA timer, escalation tracking, payout hold, and resolution template fields to Dispute

ALTER TABLE "Dispute" ADD COLUMN "slaDeadline"        TIMESTAMP(3);
ALTER TABLE "Dispute" ADD COLUMN "escalatedAt"        TIMESTAMP(3);
ALTER TABLE "Dispute" ADD COLUMN "escalatedBy"        TEXT;
ALTER TABLE "Dispute" ADD COLUMN "payoutHeldAt"       TIMESTAMP(3);
ALTER TABLE "Dispute" ADD COLUMN "resolutionTemplate" TEXT;

CREATE INDEX "Dispute_slaDeadline_idx"  ON "Dispute"("slaDeadline");
CREATE INDEX "Dispute_escalatedAt_idx" ON "Dispute"("escalatedAt");
