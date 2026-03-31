import { ApiProperty } from '@nestjs/swagger';
import {
  CorridorPricingStatus,
  CurrencyCode,
  PaymentRailProvider,
  PricingConfidenceLevel,
  PricingSourceType,
} from '@prisma/client';

export class GetCorridorPricingResponseDto {
  @ApiProperty({
    description: 'Pricing configuration ID',
    example: 'pricing-config-id',
  })
  id!: string;

  @ApiProperty({
    description: 'Canonical corridor code',
    example: 'FR_CM',
  })
  corridorCode!: string;

  @ApiProperty({
    description: 'Origin country ISO code',
    example: 'FR',
  })
  originCountryCode!: string;

  @ApiProperty({
    description: 'Destination country ISO code',
    example: 'CM',
  })
  destinationCountryCode!: string;

  @ApiProperty({
    description: 'Business priority/status of the corridor',
    enum: CorridorPricingStatus,
    example: CorridorPricingStatus.SOCLE,
  })
  status!: CorridorPricingStatus;

  @ApiProperty({
    description:
      'Technical source used to derive the pricing configuration for this corridor',
    enum: PricingSourceType,
    example: PricingSourceType.OBSERVED,
  })
  pricingSourceType!: PricingSourceType;

  @ApiProperty({
    description:
      'Calibration basis or methodology reference used for this pricing setup',
    example: 'TERRAIN_DATA',
    nullable: true,
  })
  pricingCalibrationBasis!: string | null;

  @ApiProperty({
    description:
      'Reference corridor code when pricing is inherited or templated from another corridor',
    example: null,
    nullable: true,
  })
  pricingReferenceCorridorCode!: string | null;

  @ApiProperty({
    description: 'Confidence level assigned to the pricing configuration',
    enum: PricingConfidenceLevel,
    example: PricingConfidenceLevel.HIGH,
  })
  confidenceLevel!: PricingConfidenceLevel;

  @ApiProperty({
    description:
      'Whether the pricing is estimated rather than directly observed from terrain data',
    example: false,
  })
  isEstimated!: boolean;

  @ApiProperty({
    description:
      'Whether the pricing configuration should be manually reviewed before operational reliance',
    example: false,
  })
  requiresManualReview!: boolean;

  @ApiProperty({
    description: 'Whether the corridor is visible in the product',
    example: true,
  })
  isVisible!: boolean;

  @ApiProperty({
    description: 'Whether the corridor is currently bookable',
    example: true,
  })
  isBookable!: boolean;

  @ApiProperty({
    description: 'Whether the pricing configuration is active',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description:
      'Backend-derived readiness status for booking UX decisions',
    example: 'BOOKABLE',
  })
  bookingReadinessStatus!: string;

  @ApiProperty({
    description:
      'Backend-derived readiness message for booking UX decisions',
    example: 'Corridor is available for booking.',
  })
  bookingReadinessMessage!: string;

  @ApiProperty({
    description:
      'Optional warning code returned when the pricing requires additional caution',
    example: 'ESTIMATED_PRICING',
    nullable: true,
  })
  pricingWarningCode!: string | null;

  @ApiProperty({
    description:
      'Optional warning message returned when the pricing requires additional caution',
    example: 'This corridor uses estimated pricing.',
    nullable: true,
  })
  pricingWarningMessage!: string | null;

  @ApiProperty({
    description:
      'Compact backend badge summarizing observed/estimated nature and confidence level',
    example: 'OBSERVED_HIGH_CONFIDENCE',
    nullable: true,
  })
  pricingBadge!: string | null;

  @ApiProperty({
    description:
      'Frontend-friendly pricing UI status derived from estimation and confidence signals',
    example: 'READY',
  })
  pricingUiStatus!: string;

  @ApiProperty({
    description: 'Frontend-friendly pricing UI title',
    example: 'Observed pricing',
  })
  pricingUiTitle!: string;

  @ApiProperty({
    description: 'Frontend-friendly pricing UI explanatory message',
    example: 'This corridor uses observed pricing with high confidence.',
  })
  pricingUiMessage!: string;

  @ApiProperty({
    description: 'Settlement currency used by this corridor',
    enum: CurrencyCode,
    example: CurrencyCode.EUR,
  })
  settlementCurrency!: CurrencyCode;

  @ApiProperty({
    description: 'Observed terrain price per kg',
    example: '10',
    nullable: true,
  })
  terrainPricePerKg!: string | null;

  @ApiProperty({
    description: 'Observed terrain price for 23kg bundle',
    example: '160',
    nullable: true,
  })
  terrainBundle23kg!: string | null;

  @ApiProperty({
    description: 'Observed terrain price for 32kg bundle',
    example: '210',
    nullable: true,
  })
  terrainBundle32kg!: string | null;

  @ApiProperty({
    description: 'Traveler gain per kg',
    example: '9',
    nullable: true,
  })
  travelerGainPerKg!: string | null;

  @ApiProperty({
    description: 'Sender price per kg',
    example: '11.5',
    nullable: true,
  })
  senderPricePerKg!: string | null;

  @ApiProperty({
    description: 'Platform spread per kg',
    example: '2.5',
    nullable: true,
  })
  spreadPerKg!: string | null;

  @ApiProperty({
    description: 'Traveler gain for 23kg bundle',
    example: '145',
    nullable: true,
  })
  travelerGainBundle23kg!: string | null;

  @ApiProperty({
    description: 'Sender price for 23kg bundle',
    example: '185',
    nullable: true,
  })
  senderPriceBundle23kg!: string | null;

  @ApiProperty({
    description: 'Platform spread for 23kg bundle',
    example: '40',
    nullable: true,
  })
  spreadBundle23kg!: string | null;

  @ApiProperty({
    description: 'Traveler gain for 32kg bundle',
    example: '170',
    nullable: true,
  })
  travelerGainBundle32kg!: string | null;

  @ApiProperty({
    description: 'Sender price for 32kg bundle',
    example: '210',
    nullable: true,
  })
  senderPriceBundle32kg!: string | null;

  @ApiProperty({
    description: 'Platform spread for 32kg bundle',
    example: '40',
    nullable: true,
  })
  spreadBundle32kg!: string | null;

  @ApiProperty({
    description: 'Allowed pay-in methods',
    example: ['CARD'],
    isArray: true,
  })
  payinMethodsAllowed!: string[];

  @ApiProperty({
    description: 'Allowed payout methods',
    example: ['MOBILE_MONEY'],
    isArray: true,
  })
  payoutMethodsAllowed!: string[];

  @ApiProperty({
    description: 'Primary pay-in rail',
    enum: PaymentRailProvider,
    example: PaymentRailProvider.STRIPE,
  })
  payinPrimaryRail!: PaymentRailProvider;

  @ApiProperty({
    description: 'Backup pay-in rail',
    enum: PaymentRailProvider,
    example: PaymentRailProvider.BANK,
  })
  payinBackupRail!: PaymentRailProvider | null;

  @ApiProperty({
    description: 'Primary payout rail',
    enum: PaymentRailProvider,
    example: PaymentRailProvider.CINETPAY,
  })
  payoutPrimaryRail!: PaymentRailProvider;

  @ApiProperty({
    description: 'Backup payout rail',
    enum: PaymentRailProvider,
    example: PaymentRailProvider.MANUAL,
  })
  payoutBackupRail!: PaymentRailProvider | null;

  @ApiProperty({
    description: 'Fallback rail',
    enum: PaymentRailProvider,
    example: PaymentRailProvider.MANUAL,
  })
  fallbackRail!: PaymentRailProvider | null;

  @ApiProperty({
    description: 'Optional internal note attached to the corridor pricing config',
    example: 'Seeded from canonical pricing configuration',
    nullable: true,
  })
  notes!: string | null;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-03-25T10:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-03-25T10:00:00.000Z',
  })
  updatedAt!: Date;
}