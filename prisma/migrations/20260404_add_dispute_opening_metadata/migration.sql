CREATE TYPE "DisputeInitiatedBySide" AS ENUM (
  'SENDER',
  'TRAVELER'
);

CREATE TYPE "DisputeTriggeredByRole" AS ENUM (
  'USER',
  'ADMIN'
);

ALTER TABLE "Dispute"
ADD COLUMN "initiatedBySide" "DisputeInitiatedBySide",
ADD COLUMN "triggeredByRole" "DisputeTriggeredByRole";

UPDATE "Dispute"
SET "initiatedBySide" = CASE
  WHEN "openingSource" = 'POST_DEPARTURE_BLOCK_TRAVELER' THEN 'TRAVELER'::"DisputeInitiatedBySide"
  WHEN "openingSource" = 'POST_DEPARTURE_BLOCK_SENDER' THEN 'SENDER'::"DisputeInitiatedBySide"
  WHEN "openedById" = (
    SELECT t."travelerId"
    FROM "Transaction" t
    WHERE t."id" = "Dispute"."transactionId"
  ) THEN 'TRAVELER'::"DisputeInitiatedBySide"
  ELSE 'SENDER'::"DisputeInitiatedBySide"
END;

UPDATE "Dispute"
SET "triggeredByRole" = CASE
  WHEN (
    SELECT u."role"
    FROM "User" u
    WHERE u."id" = "Dispute"."openedById"
  ) = 'ADMIN' THEN 'ADMIN'::"DisputeTriggeredByRole"
  ELSE 'USER'::"DisputeTriggeredByRole"
END;

UPDATE "Dispute"
SET "initiatedBySide" = 'SENDER'::"DisputeInitiatedBySide"
WHERE "initiatedBySide" IS NULL;

UPDATE "Dispute"
SET "triggeredByRole" = 'USER'::"DisputeTriggeredByRole"
WHERE "triggeredByRole" IS NULL;

ALTER TABLE "Dispute"
ALTER COLUMN "initiatedBySide" SET NOT NULL,
ALTER COLUMN "triggeredByRole" SET NOT NULL,
ALTER COLUMN "initiatedBySide" SET DEFAULT 'SENDER',
ALTER COLUMN "triggeredByRole" SET DEFAULT 'USER';

CREATE INDEX "Dispute_initiatedBySide_idx" ON "Dispute"("initiatedBySide");
CREATE INDEX "Dispute_triggeredByRole_idx" ON "Dispute"("triggeredByRole");