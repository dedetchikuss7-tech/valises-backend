-- 0) Ajouter la valeur legacy "ESCROW_DEBIT " (avec espace) au type enum si absente,
-- sinon Postgres ne permet pas de lire/mettre à jour ces lignes.

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

-- 1) Convertir toutes les lignes legacy vers la nouvelle valeur
UPDATE "LedgerEntry"
SET "type" = 'ESCROW_DEBIT_RELEASE'
WHERE "type" = 'ESCROW_DEBIT ';