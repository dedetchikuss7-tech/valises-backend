import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ListBehaviorRestrictionsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ enum: BehaviorRestrictionStatus })
  @IsOptional()
  @IsEnum(BehaviorRestrictionStatus)
  status?: BehaviorRestrictionStatus;

  @ApiPropertyOptional({ enum: BehaviorRestrictionScope })
  @IsOptional()
  @IsEnum(BehaviorRestrictionScope)
  scope?: BehaviorRestrictionScope;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}