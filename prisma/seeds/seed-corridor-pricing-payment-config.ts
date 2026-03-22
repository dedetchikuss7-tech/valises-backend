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

const rows: CorridorRow[] = [
  {
    corridorCode: 'FR_CM',
    originCountryCode: 'FR',
    destinationCountryCode: 'CM',

    status: 'SOCLE',
    pricingSourceType: 'OBSERVED',
    pricingCalibrationBasis: 'Observed terrain anchors consolidated from dataset',
    pricingReferenceCorridorCode: null,
    confidenceLevel: 'HIGH',

    isEstimated: false,
    requiresManualReview: false,
    isVisible: true,
    isBookable: true,

    settlementCurrency: 'EUR',

    terrainPricePerKg: 10.0,
    terrainBundle23kg: 160.0,
    terrainBundle32kg: null,

    travelerGainPerKg: 9.0,
    senderPricePerKg: 11.5,
    spreadPerKg: 2.5,

    travelerGainBundle23kg: 145.0,
    senderPriceBundle23kg: 185.0,
    spreadBundle23kg: 40.0,

    travelerGainBundle32kg: null,
    senderPriceBundle32kg: null,
    spreadBundle32kg: null,

    payinMethodsAllowed: ['CARD', 'BANK_TRANSFER'],
    payoutMethodsAllowed: ['MOBILE_MONEY', 'BANK_PAYOUT', 'MANUAL_PAYOUT'],

    payinPrimaryRail: 'STRIPE',
    payinBackupRail: 'BANK',
    payoutPrimaryRail: 'CINETPAY',
    payoutBackupRail: 'BANK',
    fallbackRail: 'MANUAL',

    isActive: true,
    notes:
      'Europe -> Afrique francophone. Corridor socle observé. Sender pays mainly via Stripe/card or bank transfer. Traveler payout primarily via CinetPay mobile money.',
  },
  {
    corridorCode: 'CM_FR',
    originCountryCode: 'CM',
    destinationCountryCode: 'FR',

    status: 'SOCLE',
    pricingSourceType: 'OBSERVED',
    pricingCalibrationBasis: 'Observed terrain anchors consolidated from dataset',
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
      'Afrique francophone -> Europe. Corridor socle observé. Sender side pay-in primarily via CinetPay mobile money. Payout to traveler primarily via Stripe/bank payout.',
  },
  {
    corridorCode: 'FR_CI',
    originCountryCode: 'FR',
    destinationCountryCode: 'CI',

    status: 'SOCLE',
    pricingSourceType: 'OBSERVED',
    pricingCalibrationBasis: 'Observed terrain anchors consolidated from dataset',
    pricingReferenceCorridorCode: null,
    confidenceLevel: 'HIGH',

    isEstimated: false,
    requiresManualReview: false,
    isVisible: true,
    isBookable: true,

    settlementCurrency: 'EUR',

    terrainPricePerKg: 9.0,
    terrainBundle23kg: 140.0,
    terrainBundle32kg: null,

    travelerGainPerKg: 8.0,
    senderPricePerKg: 10.5,
    spreadPerKg: 2.5,

    travelerGainBundle23kg: 125.0,
    senderPriceBundle23kg: 160.0,
    spreadBundle23kg: 35.0,

    travelerGainBundle32kg: null,
    senderPriceBundle32kg: null,
    spreadBundle32kg: null,

    payinMethodsAllowed: ['CARD', 'BANK_TRANSFER'],
    payoutMethodsAllowed: ['MOBILE_MONEY', 'BANK_PAYOUT', 'MANUAL_PAYOUT'],

    payinPrimaryRail: 'STRIPE',
    payinBackupRail: 'BANK',
    payoutPrimaryRail: 'CINETPAY',
    payoutBackupRail: 'BANK',
    fallbackRail: 'MANUAL',

    isActive: true,
    notes:
      'Europe -> Afrique francophone. Corridor socle observé. Côte d’Ivoire payout via mobile money/bank depending availability.',
  },
  {
    corridorCode: 'CI_FR',
    originCountryCode: 'CI',
    destinationCountryCode: 'FR',

    status: 'SOCLE',
    pricingSourceType: 'OBSERVED',
    pricingCalibrationBasis: 'Observed terrain anchors consolidated from dataset',
    pricingReferenceCorridorCode: null,
    confidenceLevel: 'HIGH',

    isEstimated: false,
    requiresManualReview: false,
    isVisible: true,
    isBookable: true,

    settlementCurrency: 'EUR',

    terrainPricePerKg: 9.0,
    terrainBundle23kg: 135.0,
    terrainBundle32kg: null,

    travelerGainPerKg: 8.0,
    senderPricePerKg: 10.5,
    spreadPerKg: 2.5,

    travelerGainBundle23kg: 120.0,
    senderPriceBundle23kg: 155.0,
    spreadBundle23kg: 35.0,

    travelerGainBundle32kg: null,
    senderPriceBundle32kg: null,
    spreadBundle32kg: null,

    payinMethodsAllowed: ['MOBILE_MONEY', 'CARD', 'BANK_TRANSFER'],
    payoutMethodsAllowed: ['BANK_PAYOUT', 'MANUAL_PAYOUT'],

    payinPrimaryRail: 'CINETPAY',
    payinBackupRail: 'BANK',
    payoutPrimaryRail: 'STRIPE',
    payoutBackupRail: 'BANK',
    fallbackRail: 'MANUAL',

    isActive: true,
    notes: 'Afrique francophone -> Europe. Corridor socle observé.',
  },
  {
    corridorCode: 'FR_SN',
    originCountryCode: 'FR',
    destinationCountryCode: 'SN',

    status: 'SOCLE',
    pricingSourceType: 'OBSERVED',
    pricingCalibrationBasis: 'Observed terrain anchors consolidated from dataset',
    pricingReferenceCorridorCode: null,
    confidenceLevel: 'HIGH',

    isEstimated: false,
    requiresManualReview: false,
    isVisible: true,
    isBookable: true,

    settlementCurrency: 'EUR',

    terrainPricePerKg: 9.0,
    terrainBundle23kg: 135.0,
    terrainBundle32kg: null,

    travelerGainPerKg: 8.0,
    senderPricePerKg: 10.5,
    spreadPerKg: 2.5,

    travelerGainBundle23kg: 120.0,
    senderPriceBundle23kg: 155.0,
    spreadBundle23kg: 35.0,

    travelerGainBundle32kg: null,
    senderPriceBundle32kg: null,
    spreadBundle32kg: null,

    payinMethodsAllowed: ['CARD', 'BANK_TRANSFER'],
    payoutMethodsAllowed: ['MOBILE_MONEY', 'BANK_PAYOUT', 'MANUAL_PAYOUT'],

    payinPrimaryRail: 'STRIPE',
    payinBackupRail: 'BANK',
    payoutPrimaryRail: 'CINETPAY',
    payoutBackupRail: 'BANK',
    fallbackRail: 'MANUAL',

    isActive: true,
    notes: 'Europe -> Afrique francophone. Corridor socle observé.',
  },
  {
    corridorCode: 'SN_FR',
    originCountryCode: 'SN',
    destinationCountryCode: 'FR',

    status: 'SOCLE',
    pricingSourceType: 'OBSERVED',
    pricingCalibrationBasis: 'Observed terrain anchors consolidated from dataset',
    pricingReferenceCorridorCode: null,
    confidenceLevel: 'HIGH',

    isEstimated: false,
    requiresManualReview: false,
    isVisible: true,
    isBookable: true,

    settlementCurrency: 'EUR',

    terrainPricePerKg: 11.0,
    terrainBundle23kg: 145.0,
    terrainBundle32kg: null,

    travelerGainPerKg: 10.0,
    senderPricePerKg: 12.5,
    spreadPerKg: 2.5,

    travelerGainBundle23kg: 130.0,
    senderPriceBundle23kg: 170.0,
    spreadBundle23kg: 40.0,

    travelerGainBundle32kg: null,
    senderPriceBundle32kg: null,
    spreadBundle32kg: null,

    payinMethodsAllowed: ['MOBILE_MONEY', 'CARD', 'BANK_TRANSFER'],
    payoutMethodsAllowed: ['BANK_PAYOUT', 'MANUAL_PAYOUT'],

    payinPrimaryRail: 'CINETPAY',
    payinBackupRail: 'BANK',
    payoutPrimaryRail: 'STRIPE',
    payoutBackupRail: 'BANK',
    fallbackRail: 'MANUAL',

    isActive: true,
    notes:
      'Afrique francophone -> Europe. Corridor socle observé. Higher terrain anchor than FR_SN.',
  },
  {
    corridorCode: 'DE_CM',
    originCountryCode: 'DE',
    destinationCountryCode: 'CM',

    status: 'SOCLE',
    pricingSourceType: 'OBSERVED',
    pricingCalibrationBasis: 'Observed terrain anchors consolidated from dataset',
    pricingReferenceCorridorCode: null,
    confidenceLevel: 'HIGH',

    isEstimated: false,
    requiresManualReview: false,
    isVisible: true,
    isBookable: true,

    settlementCurrency: 'EUR',

    terrainPricePerKg: 10.0,
    terrainBundle23kg: 145.0,
    terrainBundle32kg: 180.0,

    travelerGainPerKg: 9.0,
    senderPricePerKg: 11.5,
    spreadPerKg: 2.5,

    travelerGainBundle23kg: 130.0,
    senderPriceBundle23kg: 170.0,
    spreadBundle23kg: 40.0,

    travelerGainBundle32kg: 160.0,
    senderPriceBundle32kg: 205.0,
    spreadBundle32kg: 45.0,

    payinMethodsAllowed: ['CARD', 'BANK_TRANSFER'],
    payoutMethodsAllowed: ['MOBILE_MONEY', 'BANK_PAYOUT', 'MANUAL_PAYOUT'],

    payinPrimaryRail: 'STRIPE',
    payinBackupRail: 'BANK',
    payoutPrimaryRail: 'CINETPAY',
    payoutBackupRail: 'BANK',
    fallbackRail: 'MANUAL',

    isActive: true,
    notes:
      'Europe -> Afrique francophone. Corridor socle observé. Includes calibrated 32kg bundle.',
  },
  {
    corridorCode: 'CA_CM',
    originCountryCode: 'CA',
    destinationCountryCode: 'CM',

    status: 'SOCLE',
    pricingSourceType: 'OBSERVED',
    pricingCalibrationBasis: 'Observed terrain anchors consolidated from dataset',
    pricingReferenceCorridorCode: null,
    confidenceLevel: 'HIGH',

    isEstimated: false,
    requiresManualReview: false,
    isVisible: true,
    isBookable: true,

    settlementCurrency: 'CAD',

    terrainPricePerKg: 11.0,
    terrainBundle23kg: 250.0,
    terrainBundle32kg: null,

    travelerGainPerKg: 10.0,
    senderPricePerKg: 13.0,
    spreadPerKg: 3.0,

    travelerGainBundle23kg: 225.0,
    senderPriceBundle23kg: 285.0,
    spreadBundle23kg: 60.0,

    travelerGainBundle32kg: null,
    senderPriceBundle32kg: null,
    spreadBundle32kg: null,

    payinMethodsAllowed: ['CARD', 'BANK_TRANSFER'],
    payoutMethodsAllowed: ['MOBILE_MONEY', 'BANK_PAYOUT', 'MANUAL_PAYOUT'],

    payinPrimaryRail: 'STRIPE',
    payinBackupRail: 'BANK',
    payoutPrimaryRail: 'CINETPAY',
    payoutBackupRail: 'BANK',
    fallbackRail: 'MANUAL',

    isActive: true,
    notes:
      'Canada -> Cameroun. Corridor socle observé. Settlement in CAD. Spread kept at 3.0 based on current doctrine.',
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
    console.error('SEED_CORRIDOR_PRICING_FAILED', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });