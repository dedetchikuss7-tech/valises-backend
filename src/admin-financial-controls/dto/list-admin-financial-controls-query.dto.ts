import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum AdminFinancialControlStatus {
  CLEAN = 'CLEAN',
  WARNING = 'WARNING',
  BREACH = 'BREACH',
}

export enum AdminFinancialControlsSortBy {
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT',
  STATUS = 'STATUS',
  TRANSACTION_AMOUNT = 'TRANSACTION_AMOUNT',
  REMAINING_ESCROW = 'REMAINING_ESCROW',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListAdminFinancialControlsQueryDto {
  @ApiPropertyOptional({
    enum: AdminFinancialControlStatus,
    description: 'Optional derived control status filter',
  })
  @IsOptional()
  @IsEnum(AdminFinancialControlStatus)
  status?: AdminFinancialControlStatus;

  @ApiPropertyOptional({
    description: 'Optional transaction filter',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'Optional user filter',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Free-text search across signals, ids, statuses and currency',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Only rows requiring action',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresAction?: boolean;

  @ApiPropertyOptional({
    enum: AdminFinancialControlsSortBy,
    description: 'Sorting field',
    default: AdminFinancialControlsSortBy.UPDATED_AT,
  })
  @IsOptional()
  @IsEnum(AdminFinancialControlsSortBy)
  sortBy?: AdminFinancialControlsSortBy = AdminFinancialControlsSortBy.UPDATED_AT;

  @ApiPropertyOptional({
    enum: SortOrder,
    description: 'Sorting order',
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    description: 'Maximum number of control rows to return',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Number of items to skip before returning results',
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}