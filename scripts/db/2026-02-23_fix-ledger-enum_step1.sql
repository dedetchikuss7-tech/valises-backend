DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LedgerEntryType' AND e.enumlabel = 'ESCROW_DEBIT '
  ) THEN
    ALTER TYPE "LedgerEntryType" ADD VALUE 'ESCROW_DEBIT ';
  END IF;
END $$;