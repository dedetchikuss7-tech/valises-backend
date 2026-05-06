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

export enum AdminReconciliationUrgencyLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum AdminReconciliationRecommendedAction {
  NO_ACTION_REQUIRED = 'NO_ACTION_REQUIRED',
  REVIEW_PENDING_PROVIDER_STATUS = 'REVIEW_PENDING_PROVIDER_STATUS',
  RETRY_OR_ESCALATE_PROVIDER_FAILURE = 'RETRY_OR_ESCALATE_PROVIDER_FAILURE',
  INVESTIGATE_RECONCILIATION_MISMATCH = 'INVESTIGATE_RECONCILIATION_MISMATCH',
  REVIEW_ALREADY_ACKNOWLEDGED_CASE = 'REVIEW_ALREADY_ACKNOWLEDGED_CASE',
}

export enum AdminReconciliationSortBy {
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT',
  STATUS = 'STATUS',
  CASE_TYPE = 'CASE_TYPE',
  AMOUNT = 'AMOUNT',
  AGE_MINUTES = 'AGE_MINUTES',
  URGENCY = 'URGENCY',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListAdminReconciliationCasesQueryDto {
  @ApiPropertyOptional({ enum: AdminReconciliationCaseType })
  @IsOptional()
  @IsEnum(AdminReconciliationCaseType)
  caseType?: AdminReconciliationCaseType;

  @ApiPropertyOptional({ enum: AdminReconciliationDerivedStatus })
  @IsOptional()
  @IsEnum(AdminReconciliationDerivedStatus)
  status?: AdminReconciliationDerivedStatus;

  @ApiPropertyOptional({ enum: AdminReconciliationUrgencyLevel })
  @IsOptional()
  @IsEnum(AdminReconciliationUrgencyLevel)
  urgencyLevel?: AdminReconciliationUrgencyLevel;

  @ApiPropertyOptional({ enum: AdminReconciliationRecommendedAction })
  @IsOptional()
  @IsEnum(AdminReconciliationRecommendedAction)
  recommendedAction?: AdminReconciliationRecommendedAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Free-text search across provider, statuses, signals, ids and recommended actions',
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
    description: 'Filter reviewed/non-reviewed rows based on RECONCILIATION_REVIEW audits',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isReviewed?: boolean;

  @ApiPropertyOptional({
    enum: AdminReconciliationSortBy,
    default: AdminReconciliationSortBy.UPDATED_AT,
  })
  @IsOptional()
  @IsEnum(AdminReconciliationSortBy)
  sortBy?: AdminReconciliationSortBy = AdminReconciliationSortBy.UPDATED_AT;

  @ApiPropertyOptional({
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
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
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}