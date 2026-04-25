import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdminOwnershipObjectType,
  AdminOwnershipOperationalStatus,
} from '@prisma/client';
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
import {
  AdminWorkloadRecommendedAction,
  AdminWorkloadSlaStatus,
  AdminWorkloadUrgencyLevel,
} from './admin-workload-urgency.dto';

export enum AdminWorkloadQueuePreset {
  ALL_OPEN = 'ALL_OPEN',
  UNASSIGNED = 'UNASSIGNED',
  MY_QUEUE = 'MY_QUEUE',
  OVERDUE = 'OVERDUE',
  DUE_SOON = 'DUE_SOON',
  CLAIMED = 'CLAIMED',
  IN_REVIEW = 'IN_REVIEW',
  WAITING_EXTERNAL = 'WAITING_EXTERNAL',
  DONE = 'DONE',
  RELEASED = 'RELEASED',
}

export enum AdminWorkloadSortBy {
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT',
  SLA_DUE_AT = 'SLA_DUE_AT',
  STATUS = 'STATUS',
  OBJECT_TYPE = 'OBJECT_TYPE',
  ASSIGNED_ADMIN_ID = 'ASSIGNED_ADMIN_ID',
  URGENCY_LEVEL = 'URGENCY_LEVEL',
  SLA_STATUS = 'SLA_STATUS',
  RECOMMENDED_ACTION = 'RECOMMENDED_ACTION',
  LAST_ADMIN_ACTION_AT = 'LAST_ADMIN_ACTION_AT',
  ADMIN_ACTION_COUNT = 'ADMIN_ACTION_COUNT',
  NEEDS_REVIEW_ATTENTION = 'NEEDS_REVIEW_ATTENTION',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListAdminWorkloadQueueQueryDto {
  @ApiPropertyOptional({
    enum: AdminOwnershipObjectType,
    description: 'Optional object type filter',
  })
  @IsOptional()
  @IsEnum(AdminOwnershipObjectType)
  objectType?: AdminOwnershipObjectType;

  @ApiPropertyOptional({
    enum: AdminOwnershipOperationalStatus,
    description: 'Optional operational status filter',
  })
  @IsOptional()
  @IsEnum(AdminOwnershipOperationalStatus)
  operationalStatus?: AdminOwnershipOperationalStatus;

  @ApiPropertyOptional({
    description: 'Optional assigned admin filter',
  })
  @IsOptional()
  @IsString()
  assignedAdminId?: string;

  @ApiPropertyOptional({
    enum: AdminWorkloadUrgencyLevel,
    description: 'Optional urgency level filter',
  })
  @IsOptional()
  @IsEnum(AdminWorkloadUrgencyLevel)
  urgencyLevel?: AdminWorkloadUrgencyLevel;

  @ApiPropertyOptional({
    enum: AdminWorkloadSlaStatus,
    description: 'Optional SLA status filter',
  })
  @IsOptional()
  @IsEnum(AdminWorkloadSlaStatus)
  slaStatus?: AdminWorkloadSlaStatus;

  @ApiPropertyOptional({
    enum: AdminWorkloadRecommendedAction,
    description: 'Optional recommended action filter',
  })
  @IsOptional()
  @IsEnum(AdminWorkloadRecommendedAction)
  recommendedAction?: AdminWorkloadRecommendedAction;

  @ApiPropertyOptional({
    description:
      'Free-text search across object id, object type, operational status, assigned admin id, urgency fields, review visibility fields and metadata',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Only rows with or without recent admin action',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasRecentAdminAction?: boolean;

  @ApiPropertyOptional({
    description: 'Only rows that need or do not need review attention',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  needsReviewAttention?: boolean;

  @ApiPropertyOptional({
    enum: AdminWorkloadSortBy,
    default: AdminWorkloadSortBy.UPDATED_AT,
  })
  @IsOptional()
  @IsEnum(AdminWorkloadSortBy)
  sortBy?: AdminWorkloadSortBy = AdminWorkloadSortBy.UPDATED_AT;

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