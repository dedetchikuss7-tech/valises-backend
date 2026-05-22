import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

type CorridorPricingStatus = 'SOCLE' | 'SECONDARY' | 'FALLBACK';
type PricingSourceType =
  | 'OBSERVED'
  | 'SIMILAR_INHERITED'
  | 'REGIONAL_TEMPLATE'
  | 'MANUAL_OVERRIDE';
type PricingConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
type CurrencyCode = 'EUR' | 'USD' | 'CAD' | 'XAF' | 'XOF' | 'MAD';
type PaymentRailProvider =
  | 'STRIPE'
  | 'CINETPAY'
  | 'FLUTTERWAVE'
  | 'PAYSTACK'
  | 'MANUAL'
  | 'BANK';

type CorridorRow = {
  corridorCode: string;
  originCountryCode: string;
  destinationCountryCode: string;

  status: CorridorPricingStatus;
  pricingSourceType: PricingSourceType;
  pricingCalibrationBasis: string | null;
  pricingReferenceCorridorCode: string | null;
  confidenceLevel: PricingConfidenceLevel;

  isEstimated: boolean;
  requiresManualReview: boolean;
  isVisible: boolean;
  isBookable: boolean;

  settlementCurrency: CurrencyCode;

  terrainPricePerKg: number | null;
  terrainBundle23kg: number | null;
  terrainBundle32kg: number | null;

  travelerGainPerKg: number | null;
  senderPricePerKg: number | null;
  spreadPerKg: number | null;

  travelerGainBundle23kg: number | null;
  senderPriceBundle23kg: number | null;
  spreadBundle23kg: number | null;

  travelerGainBundle32kg: number | null;
  senderPriceBundle32kg: number | null;
  spreadBundle32kg: number | null;

  payinMethodsAllowed: string[];
  payoutMethodsAllowed: string[];

  payinPrimaryRail: PaymentRailProvider;
  payinBackupRail: PaymentRailProvider | null;
  payoutPrimaryRail: PaymentRailProvider;
  payoutBackupRail: PaymentRailProvider | null;
  fallbackRail: PaymentRailProvider;

  isActive: boolean;
  notes: string;
};

// Production corridors — Africa (Cameroon / Senegal / Ivory Coast) → Europe/Canada
// Pricing based on observed terrain anchors (terrain = informal market rate).
// senderPricePerKg in EUR (or CAD for CM_CA); XAF peg: 1 EUR = 655.957 XAF.
const rows: CorridorRow[] = [
  {
    corridorCode: 'CM_FR',
    originCountryCode: 'CM',
    destinationCountryCode: 'FR',

    status: 'SOCLE',
    pricingSourceType: 'OBSERVED',
    pricingCalibrationBasis: 'Observed terrain anchors — Cameroon diaspora France 2024',
    pricingReferenceCorridorCode: null,
    confidenceLevel: 'HIGH',

    isEstimated: false,
    requiresManualReview: false,
    isVisible: true,
    isBookable: true,

    settlementCurrency: 'EUR',

    terrainPricePerKg: 9.0,
    terrainBundle23kg: 135.0,
    terrainBundle32kg: 190.0,

    travelerGainPerKg: 8.0,
    senderPricePerKg: 10.5,
    spreadPerKg: 2.5,

    travelerGainBundle23kg: 120.0,
    senderPriceBundle23kg: 155.0,
    spreadBundle23kg: 35.0,

    travelerGainBundle32kg: 170.0,
    senderPriceBundle32kg: 210.0,
    spreadBundle32kg: 40.0,

    payinMethodsAllowed: ['MOBILE_MONEY', 'CARD', 'BANK_TRANSFER'],
    payoutMethodsAllowed: ['BANK_PAYOUT', 'MANUAL_PAYOUT'],

    payinPrimaryRail: 'CINETPAY',
    payinBackupRail: 'BANK',
    payoutPrimaryRail: 'STRIPE',
    payoutBackupRail: 'BANK',
    fallbackRail: 'MANUAL',

    isActive: true,
    notes:
      'CM→FR. Corridor socle production. Payin via CinetPay mobile money (XAF). Payout to traveler via Stripe in EUR.',
  },
  {
    corridorCode: 'CM_BE',
    originCountryCode: 'CM',
    destinationCountryCode: 'BE',

    status: 'SOCLE',
    pricingSourceType: 'OBSERVED',
    pricingCalibrationBasis: 'Observed terrain anchors — Cameroon diaspora Belgium 2024',
    pricingReferenceCorridorCode: 'CM_FR',
    confidenceLevel: 'HIGH',

    isEstimated: false,
    requiresManualReview: false,
    isVisible: true,
    isBookable: true,

    settlementCurrency: 'EUR',

    terrainPricePerKg: 9.5,
    terrainBundle23kg: 140.0,
    terrainBundle32kg: 195.0,

    travelerGainPerKg: 8.5,
    senderPricePerKg: 11.0,
    spreadPerKg: 2.5,

    travelerGainBundle23kg: 125.0,
    senderPriceBundle23kg: 160.0,
    spreadBundle23kg: 35.0,

    travelerGainBundle32kg: 175.0,
    senderPriceBundle32kg: 215.0,
    spreadBundle32kg: 40.0,

    payinMethodsAllowed: ['MOBILE_MONEY', 'CARD', 'BANK_TRANSFER'],
    payoutMethodsAllowed: ['BANK_PAYOUT', 'MANUAL_PAYOUT'],

    payinPrimaryRail: 'CINETPAY',
    payinBackupRail: 'BANK',
    payoutPrimaryRail: 'STRIPE',
    payoutBackupRail: 'BANK',
    fallbackRail: 'MANUAL',

    isActive: true,
    notes:
      'CM→BE. Corridor socle production. Slightly higher terrain anchor than CM_FR. EUR settlement. CinetPay payin / Stripe payout.',
  },
  {
    corridorCode: 'CM_CA',
    originCountryCode: 'CM',
    destinationCountryCode: 'CA',

    status: 'SOCLE',
    pricingSourceType: 'OBSERVED',
    pricingCalibrationBasis: 'Observed terrain anchors — Cameroon diaspora Canada 2024',
    pricingReferenceCorridorCode: null,
    confidenceLevel: 'HIGH',

    isEstimated: false,
    requiresManualReview: false,
    isVisible: true,
    isBookable: true,

    settlementCurrency: 'CAD',

    terrainPricePerKg: 12.0,
    terrainBundle23kg: 270.0,
    terrainBundle32kg: 370.0,

    travelerGainPerKg: 11.0,
    senderPricePerKg: 14.0,
    spreadPerKg: 3.0,

    travelerGainBundle23kg: 235.0,
    senderPriceBundle23kg: 295.0,
    spreadBundle23kg: 60.0,

    travelerGainBundle32kg: 310.0,
    senderPriceBundle32kg: 400.0,
    spreadBundle32kg: 90.0,

    payinMethodsAllowed: ['MOBILE_MONEY', 'CARD', 'BANK_TRANSFER'],
    payoutMethodsAllowed: ['BANK_PAYOUT', 'MANUAL_PAYOUT'],

    payinPrimaryRail: 'CINETPAY',
    payinBackupRail: 'BANK',
    payoutPrimaryRail: 'STRIPE',
    payoutBackupRail: 'BANK',
    fallbackRail: 'MANUAL',

    isActive: true,
    notes:
      'CM→CA. Corridor socle production. Settlement in CAD. Higher spread (3.0 CAD/kg) due to intercontinental leg and FX conversion.',
  },
  {
    corridorCode: 'CM_CH',
    originCountryCode: 'CM',
    destinationCountryCode: 'CH',

    status: 'SOCLE',
    pricingSourceType: 'OBSERVED',
    pricingCalibrationBasis: 'Observed terrain anchors — Cameroon diaspora Switzerland 2024',
    pricingReferenceCorridorCode: 'CM_FR',
    confidenceLevel: 'HIGH',

    isEstimated: false,
    requiresManualReview: false,
    isVisible: true,
    isBookable: true,

    settlementCurrency: 'EUR',

    terrainPricePerKg: 10.5,
    terrainBundle23kg: 150.0,
    terrainBundle32kg: 210.0,

    travelerGainPerKg: 9.5,
    senderPricePerKg: 12.0,
    spreadPerKg: 2.5,

    travelerGainBundle23kg: 135.0,
    senderPriceBundle23kg: 175.0,
    spreadBundle23kg: 40.0,

    travelerGainBundle32kg: 190.0,
    senderPriceBundle32kg: 240.0,
    spreadBundle32kg: 50.0,

    payinMethodsAllowed: ['MOBILE_MONEY', 'CARD', 'BANK_TRANSFER'],
    payoutMethodsAllowed: ['BANK_PAYOUT', 'MANUAL_PAYOUT'],

    payinPrimaryRail: 'CINETPAY',
    payinBackupRail: 'BANK',
    payoutPrimaryRail: 'STRIPE',
    payoutBackupRail: 'BANK',
    fallbackRail: 'MANUAL',

    isActive: true,
    notes:
      'CM→CH. Corridor socle production. EUR settlement (CHF/EUR near-parity for ops). Higher terrain anchor reflects premium Switzerland leg.',
  },
  {
    corridorCode: 'SN_FR',
    originCountryCode: 'SN',
    destinationCountryCode: 'FR',

    status: 'SOCLE',
    pricingSourceType: 'OBSERVED',
    pricingCalibrationBasis: 'Observed terrain anchors — Senegal diaspora France 2024',
    pricingReferenceCorridorCode: null,
    confidenceLevel: 'HIGH',

    isEstimated: false,
    requiresManualReview: false,
    isVisible: true,
    isBookable: true,

    settlementCurrency: 'EUR',

    terrainPricePerKg: 11.0,
    terrainBundle23kg: 145.0,
    terrainBundle32kg: 200.0,

    travelerGainPerKg: 10.0,
    senderPricePerKg: 12.5,
    spreadPerKg: 2.5,

    travelerGainBundle23kg: 130.0,
    senderPriceBundle23kg: 170.0,
    spreadBundle23kg: 40.0,

    travelerGainBundle32kg: 185.0,
    senderPriceBundle32kg: 235.0,
    spreadBundle32kg: 50.0,

    payinMethodsAllowed: ['MOBILE_MONEY', 'CARD', 'BANK_TRANSFER'],
    payoutMethodsAllowed: ['BANK_PAYOUT', 'MANUAL_PAYOUT'],

    payinPrimaryRail: 'CINETPAY',
    payinBackupRail: 'BANK',
    payoutPrimaryRail: 'STRIPE',
    payoutBackupRail: 'BANK',
    fallbackRail: 'MANUAL',

    isActive: true,
    notes:
      'SN→FR. Corridor socle production. Slightly higher terrain anchor than CM_FR. XOF/EUR peg. CinetPay payin / Stripe payout.',
  },
  {
    corridorCode: 'CI_FR',
    originCountryCode: 'CI',
    destinationCountryCode: 'FR',

    status: 'SOCLE',
    pricingSourceType: 'OBSERVED',
    pricingCalibrationBasis: 'Observed terrain anchors — Ivory Coast diaspora France 2024',
    pricingReferenceCorridorCode: 'CM_FR',
    confidenceLevel: 'HIGH',

    isEstimated: false,
    requiresManualReview: false,
    isVisible: true,
    isBookable: true,

    settlementCurrency: 'EUR',

    terrainPricePerKg: 9.0,
    terrainBundle23kg: 135.0,
    terrainBundle32kg: 190.0,

    travelerGainPerKg: 8.0,
    senderPricePerKg: 10.5,
    spreadPerKg: 2.5,

    travelerGainBundle23kg: 120.0,
    senderPriceBundle23kg: 155.0,
    spreadBundle23kg: 35.0,

    travelerGainBundle32kg: 170.0,
    senderPriceBundle32kg: 210.0,
    spreadBundle32kg: 40.0,

    payinMethodsAllowed: ['MOBILE_MONEY', 'CARD', 'BANK_TRANSFER'],
    payoutMethodsAllowed: ['BANK_PAYOUT', 'MANUAL_PAYOUT'],

    payinPrimaryRail: 'CINETPAY',
    payinBackupRail: 'BANK',
    payoutPrimaryRail: 'STRIPE',
    payoutBackupRail: 'BANK',
    fallbackRail: 'MANUAL',

    isActive: true,
    notes:
      'CI→FR. Corridor socle production. Pricing anchored to CM_FR terrain (similar XOF zone). CinetPay payin / Stripe payout.',
  },
];

async function upsertRow(row: CorridorRow) {
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "corridor_pricing_payment_config" (
      "id",
      "corridor_code",
      "origin_country_code",
      "destination_country_code",

      "status",
      "pricing_source_type",
      "pricing_calibration_basis",
      "pricing_reference_corridor_code",
      "confidence_level",

      "is_estimated",
      "requires_manual_review",
      "is_visible",
      "is_bookable",

      "settlement_currency",

      "terrain_price_per_kg",
      "terrain_bundle_23kg",
      "terrain_bundle_32kg",

      "traveler_gain_per_kg",
      "sender_price_per_kg",
      "spread_per_kg",

      "traveler_gain_bundle_23kg",
      "sender_price_bundle_23kg",
      "spread_bundle_23kg",

      "traveler_gain_bundle_32kg",
      "sender_price_bundle_32kg",
      "spread_bundle_32kg",

      "payin_methods_allowed",
      "payout_methods_allowed",

      "payin_primary_rail",
      "payin_backup_rail",
      "payout_primary_rail",
      "payout_backup_rail",
      "fallback_rail",

      "is_active",
      "notes",
      "created_at",
      "updated_at"
    )
    VALUES (
      $1, $2, $3, $4,
      $5::"CorridorPricingStatus",
      $6::"PricingSourceType",
      $7,
      $8,
      $9::"PricingConfidenceLevel",
      $10,
      $11,
      $12,
      $13,
      $14::"CurrencyCode",
      $15, $16, $17,
      $18, $19, $20,
      $21, $22, $23,
      $24, $25, $26,
      $27::jsonb, $28::jsonb,
      $29::"PaymentRailProvider",
      $30::"PaymentRailProvider",
      $31::"PaymentRailProvider",
      $32::"PaymentRailProvider",
      $33::"PaymentRailProvider",
      $34, $35, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("corridor_code")
    DO UPDATE SET
      "origin_country_code" = EXCLUDED."origin_country_code",
      "destination_country_code" = EXCLUDED."destination_country_code",

      "status" = EXCLUDED."status",
      "pricing_source_type" = EXCLUDED."pricing_source_type",
      "pricing_calibration_basis" = EXCLUDED."pricing_calibration_basis",
      "pricing_reference_corridor_code" = EXCLUDED."pricing_reference_corridor_code",
      "confidence_level" = EXCLUDED."confidence_level",

      "is_estimated" = EXCLUDED."is_estimated",
      "requires_manual_review" = EXCLUDED."requires_manual_review",
      "is_visible" = EXCLUDED."is_visible",
      "is_bookable" = EXCLUDED."is_bookable",

      "settlement_currency" = EXCLUDED."settlement_currency",

      "terrain_price_per_kg" = EXCLUDED."terrain_price_per_kg",
      "terrain_bundle_23kg" = EXCLUDED."terrain_bundle_23kg",
      "terrain_bundle_32kg" = EXCLUDED."terrain_bundle_32kg",

      "traveler_gain_per_kg" = EXCLUDED."traveler_gain_per_kg",
      "sender_price_per_kg" = EXCLUDED."sender_price_per_kg",
      "spread_per_kg" = EXCLUDED."spread_per_kg",

      "traveler_gain_bundle_23kg" = EXCLUDED."traveler_gain_bundle_23kg",
      "sender_price_bundle_23kg" = EXCLUDED."sender_price_bundle_23kg",
      "spread_bundle_23kg" = EXCLUDED."spread_bundle_23kg",

      "traveler_gain_bundle_32kg" = EXCLUDED."traveler_gain_bundle_32kg",
      "sender_price_bundle_32kg" = EXCLUDED."sender_price_bundle_32kg",
      "spread_bundle_32kg" = EXCLUDED."spread_bundle_32kg",

      "payin_methods_allowed" = EXCLUDED."payin_methods_allowed",
      "payout_methods_allowed" = EXCLUDED."payout_methods_allowed",

      "payin_primary_rail" = EXCLUDED."payin_primary_rail",
      "payin_backup_rail" = EXCLUDED."payin_backup_rail",
      "payout_primary_rail" = EXCLUDED."payout_primary_rail",
      "payout_backup_rail" = EXCLUDED."payout_backup_rail",
      "fallback_rail" = EXCLUDED."fallback_rail",

      "is_active" = EXCLUDED."is_active",
      "notes" = EXCLUDED."notes",
      "updated_at" = CURRENT_TIMESTAMP
    `,
    randomUUID(),
    row.corridorCode,
    row.originCountryCode,
    row.destinationCountryCode,

    row.status,
    row.pricingSourceType,
    row.pricingCalibrationBasis,
    row.pricingReferenceCorridorCode,
    row.confidenceLevel,

    row.isEstimated,
    row.requiresManualReview,
    row.isVisible,
    row.isBookable,

    row.settlementCurrency,

    row.terrainPricePerKg,
    row.terrainBundle23kg,
    row.terrainBundle32kg,

    row.travelerGainPerKg,
    row.senderPricePerKg,
    row.spreadPerKg,

    row.travelerGainBundle23kg,
    row.senderPriceBundle23kg,
    row.spreadBundle23kg,

    row.travelerGainBundle32kg,
    row.senderPriceBundle32kg,
    row.spreadBundle32kg,

    JSON.stringify(row.payinMethodsAllowed),
    JSON.stringify(row.payoutMethodsAllowed),

    row.payinPrimaryRail,
    row.payinBackupRail,
    row.payoutPrimaryRail,
    row.payoutBackupRail,
    row.fallbackRail,

    row.isActive,
    row.notes,
  );
}

async function main() {
  for (const row of rows) {
    await upsertRow(row);
    console.log(`UPSERTED ${row.corridorCode}`);
  }

  const countResult = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
    `SELECT COUNT(*)::text AS count FROM "corridor_pricing_payment_config"`,
  );

  console.log('TOTAL_ROWS', countResult[0]?.count ?? '0');
}

main()
  .catch((error) => {
    console.error('SEED_PRODUCTION_CORRIDORS_FAILED', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
