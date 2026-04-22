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

export enum AdminReconciliationCaseType {
  PAYOUT = 'PAYOUT',
  REFUND = 'REFUND',
}

export enum AdminReconciliationDerivedStatus {
  CLEAN = 'CLEAN',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
  MISMATCH = 'MISMATCH',
}

export enum AdminReconciliationSortBy {
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT',
  STATUS = 'STATUS',
  CASE_TYPE = 'CASE_TYPE',
  AMOUNT = 'AMOUNT',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListAdminReconciliationCasesQueryDto {
  @ApiPropertyOptional({
    enum: AdminReconciliationCaseType,
    description: 'Optional reconciliation type filter',
  })
  @IsOptional()
  @IsEnum(AdminReconciliationCaseType)
  caseType?: AdminReconciliationCaseType;

  @ApiPropertyOptional({
    enum: AdminReconciliationDerivedStatus,
    description: 'Optional derived reconciliation status filter',
  })
  @IsOptional()
  @IsEnum(AdminReconciliationDerivedStatus)
  status?: AdminReconciliationDerivedStatus;

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
    description: 'Free-text search across provider, statuses, signals and ids',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Only rows requiring reconciliation action',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresAction?: boolean;

  @ApiPropertyOptional({
    enum: AdminReconciliationSortBy,
    description: 'Sorting field',
    default: AdminReconciliationSortBy.UPDATED_AT,
  })
  @IsOptional()
  @IsEnum(AdminReconciliationSortBy)
  sortBy?: AdminReconciliationSortBy = AdminReconciliationSortBy.UPDATED_AT;

  @ApiPropertyOptional({
    enum: SortOrder,
    description: 'Sorting order',
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    description: 'Maximum number of reconciliation rows to return',
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