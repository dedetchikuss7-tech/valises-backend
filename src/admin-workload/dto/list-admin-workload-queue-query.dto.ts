import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdminOwnershipObjectType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

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
    description:
      'Free-text search across object id, object type, operational status, assigned admin id and metadata',
  })
  @IsOptional()
  @IsString()
  q?: string;

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