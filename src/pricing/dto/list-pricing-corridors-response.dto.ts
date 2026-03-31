import { ApiProperty } from '@nestjs/swagger';
import {
  CorridorPricingStatus,
  CurrencyCode,
  PricingConfidenceLevel,
  PricingSourceType,
} from '@prisma/client';

export class ListPricingCorridorsResponseDto {
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
      'Technical calibration basis used to derive the pricing configuration',
    example: 'TERRAIN_DATA',
    nullable: true,
  })
  pricingCalibrationBasis!: string | null;

  @ApiProperty({
    description:
      'Reference corridor code used when pricing was inherited or templated',
    example: 'FR_SN',
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
    description: 'Backend-derived booking readiness status',
    example: 'BOOKABLE',
  })
  bookingReadinessStatus!: string;

  @ApiProperty({
    description: 'Backend-derived booking readiness message',
    example: 'Corridor is available for booking.',
  })
  bookingReadinessMessage!: string;

  @ApiProperty({
    description: 'Frontend-friendly price display label',
    example: 'From',
  })
  priceDisplayLabel!: string;

  @ApiProperty({
    description: 'Frontend-friendly price display value',
    example: '11.5 EUR/kg',
  })
  priceDisplayValue!: string;

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
}