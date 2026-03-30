import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  CorridorPricingStatus,
  CurrencyCode,
  PricingConfidenceLevel,
  PricingSourceType,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return value as boolean;
}

export class ListPricingCorridorsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by exact corridor code',
    example: 'FR_CM',
  })
  @IsOptional()
  @IsString()
  corridorCode?: string;

  @ApiPropertyOptional({
    description: 'Filter by origin country code',
    example: 'FR',
  })
  @IsOptional()
  @IsString()
  originCountryCode?: string;

  @ApiPropertyOptional({
    description: 'Filter by destination country code',
    example: 'CM',
  })
  @IsOptional()
  @IsString()
  destinationCountryCode?: string;

  @ApiPropertyOptional({
    description: 'Filter by pricing status',
    enum: CorridorPricingStatus,
    example: CorridorPricingStatus.SOCLE,
  })
  @IsOptional()
  @IsEnum(CorridorPricingStatus)
  status?: CorridorPricingStatus;

  @ApiPropertyOptional({
    description: 'Filter by pricing confidence level',
    enum: PricingConfidenceLevel,
    example: PricingConfidenceLevel.HIGH,
  })
  @IsOptional()
  @IsEnum(PricingConfidenceLevel)
  confidenceLevel?: PricingConfidenceLevel;

  @ApiPropertyOptional({
    description: 'Filter by pricing source type',
    enum: PricingSourceType,
    example: PricingSourceType.OBSERVED,
  })
  @IsOptional()
  @IsEnum(PricingSourceType)
  pricingSourceType?: PricingSourceType;

  @ApiPropertyOptional({
    description: 'Filter by pricing calibration basis',
    example: 'TERRAIN_DATA',
  })
  @IsOptional()
  @IsString()
  pricingCalibrationBasis?: string;

  @ApiPropertyOptional({
    description: 'Filter by pricing reference corridor code',
    example: 'FR_SN',
  })
  @IsOptional()
  @IsString()
  pricingReferenceCorridorCode?: string;

  @ApiPropertyOptional({
    description: 'Filter by settlement currency',
    enum: CurrencyCode,
    example: CurrencyCode.EUR,
  })
  @IsOptional()
  @IsEnum(CurrencyCode)
  settlementCurrency?: CurrencyCode;

  @ApiPropertyOptional({
    description: 'Filter by estimated pricing',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isEstimated?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by requires manual review flag',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  requiresManualReview?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by visible pricing corridors',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isVisible?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by bookable pricing corridors',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isBookable?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by active pricing corridors',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Sort field for pricing corridor listing',
    enum: [
      'corridorCode',
      'originCountryCode',
      'destinationCountryCode',
      'status',
      'confidenceLevel',
      'settlementCurrency',
    ],
    example: 'corridorCode',
  })
  @IsOptional()
  @IsIn([
    'corridorCode',
    'originCountryCode',
    'destinationCountryCode',
    'status',
    'confidenceLevel',
    'settlementCurrency',
  ])
  sortBy?:
    | 'corridorCode'
    | 'originCountryCode'
    | 'destinationCountryCode'
    | 'status'
    | 'confidenceLevel'
    | 'settlementCurrency';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'asc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Maximum number of items to return',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}