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

export enum AdminOwnershipSortBy {
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT',
  SLA_DUE_AT = 'SLA_DUE_AT',
  STATUS = 'STATUS',
  OBJECT_TYPE = 'OBJECT_TYPE',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListAdminOwnershipQueryDto {
  @ApiPropertyOptional({ enum: AdminOwnershipObjectType })
  @IsOptional()
  @IsEnum(AdminOwnershipObjectType)
  objectType?: AdminOwnershipObjectType;

  @ApiPropertyOptional({ enum: AdminOwnershipOperationalStatus })
  @IsOptional()
  @IsEnum(AdminOwnershipOperationalStatus)
  operationalStatus?: AdminOwnershipOperationalStatus;

  @ApiPropertyOptional({
    description: 'Filter ownership rows assigned to one admin user ID',
  })
  @IsOptional()
  @IsString()
  assignedAdminId?: string;

  @ApiPropertyOptional({
    description: 'Free-text search on objectId, assignedAdminId and metadata-like fields',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Only ownership rows that are already overdue',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  onlyOverdue?: boolean;

  @ApiPropertyOptional({
    description: 'Only ownership rows due soon',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  onlyDueSoon?: boolean;

  @ApiPropertyOptional({
    enum: AdminOwnershipSortBy,
    default: AdminOwnershipSortBy.UPDATED_AT,
  })
  @IsOptional()
  @IsEnum(AdminOwnershipSortBy)
  sortBy?: AdminOwnershipSortBy = AdminOwnershipSortBy.UPDATED_AT;

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