-- CreateEnum
CREATE TYPE "CorridorPricingStatus" AS ENUM ('SOCLE', 'SECONDARY', 'FALLBACK');

-- CreateEnum
CREATE TYPE "PricingSourceType" AS ENUM (
    'OBSERVED',
    'SIMILAR_INHERITED',
    'REGIONAL_TEMPLATE',
    'MANUAL_OVERRIDE'
);

-- CreateEnum
CREATE TYPE "PricingConfidenceLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('EUR', 'USD', 'CAD', 'XAF', 'XOF', 'MAD');

-- CreateEnum
CREATE TYPE "PaymentRailProvider" AS ENUM (
    'STRIPE',
    'CINETPAY',
    'FLUTTERWAVE',
    'PAYSTACK',
    'MANUAL',
    'BANK'
);

-- CreateTable
CREATE TABLE "corridor_pricing_payment_config" (
    "id" TEXT NOT NULL,
    "corridor_code" TEXT NOT NULL,
    "origin_country_code" TEXT NOT NULL,
    "destination_country_code" TEXT NOT NULL,

    "status" "CorridorPricingStatus" NOT NULL,
    "pricing_source_type" "PricingSourceType" NOT NULL DEFAULT 'OBSERVED',
    "pricing_calibration_basis" TEXT,
    "pricing_reference_corridor_code" TEXT,
    "confidence_level" "PricingConfidenceLevel" NOT NULL DEFAULT 'MEDIUM',

    "is_estimated" BOOLEAN NOT NULL DEFAULT false,
    "requires_manual_review" BOOLEAN NOT NULL DEFAULT false,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "is_bookable" BOOLEAN NOT NULL DEFAULT true,

    "settlement_currency" "CurrencyCode" NOT NULL,

    "terrain_price_per_kg" DECIMAL(12,2),
    "terrain_bundle_23kg" DECIMAL(12,2),
    "terrain_bundle_32kg" DECIMAL(12,2),

    "traveler_gain_per_kg" DECIMAL(12,2),
    "sender_price_per_kg" DECIMAL(12,2),
    "spread_per_kg" DECIMAL(12,2),

    "traveler_gain_bundle_23kg" DECIMAL(12,2),
    "sender_price_bundle_23kg" DECIMAL(12,2),
    "spread_bundle_23kg" DECIMAL(12,2),

    "traveler_gain_bundle_32kg" DECIMAL(12,2),
    "sender_price_bundle_32kg" DECIMAL(12,2),
    "spread_bundle_32kg" DECIMAL(12,2),

    "payin_methods_allowed" JSONB NOT NULL DEFAULT '[]',
    "payout_methods_allowed" JSONB NOT NULL DEFAULT '[]',

    "payin_primary_rail" "PaymentRailProvider" NOT NULL,
    "payin_backup_rail" "PaymentRailProvider",
    "payout_primary_rail" "PaymentRailProvider" NOT NULL,
    "payout_backup_rail" "PaymentRailProvider",
    "fallback_rail" "PaymentRailProvider" NOT NULL,

    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corridor_pricing_payment_config_pkey" PRIMARY KEY ("id")
);

-- Unique index
CREATE UNIQUE INDEX "corridor_pricing_payment_config_corridor_code_key"
ON "corridor_pricing_payment_config"("corridor_code");

-- Useful lookup indexes
CREATE INDEX "corridor_pricing_payment_config_origin_destination_idx"
ON "corridor_pricing_payment_config"("origin_country_code", "destination_country_code");

CREATE INDEX "corridor_pricing_payment_config_status_idx"
ON "corridor_pricing_payment_config"("status");

CREATE INDEX "corridor_pricing_payment_config_pricing_source_type_idx"
ON "corridor_pricing_payment_config"("pricing_source_type");

CREATE INDEX "corridor_pricing_payment_config_visibility_bookable_idx"
ON "corridor_pricing_payment_config"("is_visible", "is_bookable");

-- updated_at maintenance
CREATE OR REPLACE FUNCTION set_corridor_pricing_payment_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_corridor_pricing_payment_config_updated_at
BEFORE UPDATE ON "corridor_pricing_payment_config"
FOR EACH ROW
EXECUTE FUNCTION set_corridor_pricing_payment_config_updated_at();