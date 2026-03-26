import { ApiProperty } from '@nestjs/swagger';
import {
  CorridorPricingStatus,
  CurrencyCode,
  PricingConfidenceLevel,
  PricingSourceType,
} from '@prisma/client';
import { PricingModelTypeDto } from './pricing-model-type.enum';

export class CalculateCorridorPricingResponseDto {
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
    description: 'Pricing model used for this calculation',
    enum: PricingModelTypeDto,
    example: PricingModelTypeDto.PER_KG,
  })
  pricingModelType!: PricingModelTypeDto;

  @ApiProperty({
    description: 'Settlement currency used by this corridor',
    enum: CurrencyCode,
    example: CurrencyCode.EUR,
  })
  settlementCurrency!: CurrencyCode;

  @ApiProperty({
    description: 'Computed sender price for the selected pricing model',
    example: '115',
  })
  senderPrice!: string;

  @ApiProperty({
    description: 'Computed traveler gain for the selected pricing model',
    example: '90',
  })
  travelerGain!: string;

  @ApiProperty({
    description: 'Computed platform spread for the selected pricing model',
    example: '25',
  })
  spread!: string;

  @ApiProperty({
    description:
      'Applied weight in kilograms. For bundle models this returns the bundle weight.',
    example: 10,
    nullable: true,
  })
  weightKg!: number | null;

  @ApiProperty({
    description: 'Optional internal note attached to the corridor pricing config',
    example: 'Seeded from canonical pricing configuration',
    nullable: true,
  })
  notes!: string | null;
}