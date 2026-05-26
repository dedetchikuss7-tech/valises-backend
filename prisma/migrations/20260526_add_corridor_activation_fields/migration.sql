-- Migration: add_corridor_activation_fields
-- Adds activation toggle, pricing history snapshot, deferred effectiveAt,
-- and simple pricing fields to the Corridor model.

ALTER TABLE "Corridor"
  ADD COLUMN IF NOT EXISTS "isActive"       BOOLEAN   NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "pricingHistory" JSONB,
  ADD COLUMN IF NOT EXISTS "effectiveAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "basePriceXaf"   INTEGER,
  ADD COLUMN IF NOT EXISTS "pricePerKgXaf"  INTEGER,
  ADD COLUMN IF NOT EXISTS "minPriceXaf"    INTEGER,
  ADD COLUMN IF NOT EXISTS "maxPriceXaf"    INTEGER,
  ADD COLUMN IF NOT EXISTS "commissionRate" DOUBLE PRECISION;
