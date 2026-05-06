import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum LedgerIntegrityStatus {
  OK = 'OK',
  WARNING = 'WARNING',
  BREACH = 'BREACH',
}

export enum LedgerIntegritySortBy {
  UPDATED_AT = 'UPDATED_AT',
  CREATED_AT = 'CREATED_AT',
  DELTA_ABS = 'DELTA_ABS',
  SIGNAL_COUNT = 'SIGNAL_COUNT',
  TRANSACTION_AMOUNT = 'TRANSACTION_AMOUNT',
  STORED_ESCROW = 'STORED_ESCROW',
  COMPUTED_ESCROW = 'COMPUTED_ESCROW',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListLedgerMismatchesQueryDto {
  @ApiPropertyOptional({
    enum: LedgerIntegrityStatus,
    description: 'Optional integrity status filter',
    example: LedgerIntegrityStatus.BREACH,
  })
  @IsOptional()
  @IsEnum(LedgerIntegrityStatus)
  status?: LedgerIntegrityStatus;

  @ApiPropertyOptional({
    description:
      'When true, include OK rows too. By default only WARNING/BREACH rows are returned.',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeOk?: boolean = false;

  @ApiPropertyOptional({
    description: 'Only rows requiring admin action',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresAction?: boolean;

  @ApiPropertyOptional({
    description:
      'Free-text search across transaction id, users, statuses, currency, signals and recommended action',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    enum: LedgerIntegritySortBy,
    description: 'Sorting field',
    default: LedgerIntegritySortBy.UPDATED_AT,
  })
  @IsOptional()
  @IsEnum(LedgerIntegritySortBy)
  sortBy?: LedgerIntegritySortBy = LedgerIntegritySortBy.UPDATED_AT;

  @ApiPropertyOptional({
    enum: SortOrder,
    description: 'Sorting order',
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    description: 'Maximum number of transactions to inspect',
    example: 200,
    default: 200,
    minimum: 1,
    maximum: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  inspectLimit?: number = 200;

  @ApiPropertyOptional({
    description: 'Maximum number of rows to return',
    example: 50,
    default: 50,
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Number of filtered rows to skip before returning results',
    example: 0,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}