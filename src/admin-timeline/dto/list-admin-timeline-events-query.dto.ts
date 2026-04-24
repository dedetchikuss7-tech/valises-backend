import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdminTimelineObjectType,
  AdminTimelineSeverity,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum AdminTimelineSortBy {
  CREATED_AT = 'CREATED_AT',
  OBJECT_TYPE = 'OBJECT_TYPE',
  EVENT_TYPE = 'EVENT_TYPE',
  SEVERITY = 'SEVERITY',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListAdminTimelineEventsQueryDto {
  @ApiPropertyOptional({ enum: AdminTimelineObjectType })
  @IsOptional()
  @IsEnum(AdminTimelineObjectType)
  objectType?: AdminTimelineObjectType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objectId?: string;

  @ApiPropertyOptional({
    description: 'Filter by machine-readable event type',
    example: 'ADMIN_OWNERSHIP_CLAIMED',
  })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorUserId?: string;

  @ApiPropertyOptional({ enum: AdminTimelineSeverity })
  @IsOptional()
  @IsEnum(AdminTimelineSeverity)
  severity?: AdminTimelineSeverity;

  @ApiPropertyOptional({
    description: 'Free-text search across event type, title, message, object id and metadata',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    enum: AdminTimelineSortBy,
    default: AdminTimelineSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(AdminTimelineSortBy)
  sortBy?: AdminTimelineSortBy = AdminTimelineSortBy.CREATED_AT;

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