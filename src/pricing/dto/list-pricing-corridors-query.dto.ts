import { ApiPropertyOptional } from '@nestjs/swagger';
import { CorridorPricingStatus } from '@prisma/client';
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
import { ListPricingCorridorsSortByDto } from './list-pricing-corridors-sort-by.enum';

function toOptionalBoolean(value: unknown): unknown {
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

  return value;
}

export class ListPricingCorridorsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by origin country ISO code',
    example: 'FR',
  })
  @IsOptional()
  @IsString()
  originCountryCode?: string;

  @ApiPropertyOptional({
    description: 'Filter by destination country ISO code',
    example: 'CM',
  })
  @IsOptional()
  @IsString()
  destinationCountryCode?: string;

  @ApiPropertyOptional({
    description: 'Filter by corridor pricing business status',
    enum: CorridorPricingStatus,
    example: CorridorPricingStatus.SOCLE,
  })
  @IsOptional()
  @IsEnum(CorridorPricingStatus)
  status?: CorridorPricingStatus;

  @ApiPropertyOptional({
    description: 'Filter by visible corridors only or not',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isVisible?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by bookable corridors only or not',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isBookable?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by active pricing configurations only or not',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Field used to sort returned pricing corridors',
    enum: ListPricingCorridorsSortByDto,
    example: ListPricingCorridorsSortByDto.CORRIDOR_CODE,
  })
  @IsOptional()
  @IsEnum(ListPricingCorridorsSortByDto)
  sortBy?: ListPricingCorridorsSortByDto =
    ListPricingCorridorsSortByDto.ORIGIN_COUNTRY_CODE;

  @ApiPropertyOptional({
    description: 'Sort direction',
    example: 'asc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';

  @ApiPropertyOptional({
    description: 'Maximum number of pricing corridors to return',
    example: 100,
    default: 100,
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 100;
}