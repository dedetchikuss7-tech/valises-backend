import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  BehaviorRestrictionKind,
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum BehaviorRestrictionSortBy {
  IMPOSED_AT = 'IMPOSED_AT',
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT',
  EXPIRES_AT = 'EXPIRES_AT',
  STATUS = 'STATUS',
  KIND = 'KIND',
  SCOPE = 'SCOPE',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListBehaviorRestrictionsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ enum: BehaviorRestrictionStatus })
  @IsOptional()
  @IsEnum(BehaviorRestrictionStatus)
  status?: BehaviorRestrictionStatus;

  @ApiPropertyOptional({ enum: BehaviorRestrictionKind })
  @IsOptional()
  @IsEnum(BehaviorRestrictionKind)
  kind?: BehaviorRestrictionKind;

  @ApiPropertyOptional({ enum: BehaviorRestrictionScope })
  @IsOptional()
  @IsEnum(BehaviorRestrictionScope)
  scope?: BehaviorRestrictionScope;

  @ApiPropertyOptional({
    description: 'Only restrictions whose expiresAt is in the past',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  expiredOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Free-text search across user, reason and metadata',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    enum: BehaviorRestrictionSortBy,
    default: BehaviorRestrictionSortBy.IMPOSED_AT,
  })
  @IsOptional()
  @IsEnum(BehaviorRestrictionSortBy)
  sortBy?: BehaviorRestrictionSortBy = BehaviorRestrictionSortBy.IMPOSED_AT;

  @ApiPropertyOptional({
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}