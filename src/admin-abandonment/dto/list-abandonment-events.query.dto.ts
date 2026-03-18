import { Type } from 'class-transformer';
import { AbandonmentEventStatus, AbandonmentKind } from '@prisma/client';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListAbandonmentEventsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: '459e66d1-121d-429b-82cc-163baf21b052',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by trip ID',
    example: '459e66d1-121d-429b-82cc-163baf21b052',
  })
  @IsOptional()
  @IsUUID()
  tripId?: string;

  @ApiPropertyOptional({
    description: 'Filter by package ID',
    example: '04c6ef4f-980b-4cf7-9006-2ddba4003420',
  })
  @IsOptional()
  @IsUUID()
  packageId?: string;

  @ApiPropertyOptional({
    description: 'Filter by transaction ID',
    example: '0b47d0e1-739f-4c9e-94fe-8a0f7a6ddc31',
  })
  @IsOptional()
  @IsUUID()
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'Filter by abandonment kind',
    enum: AbandonmentKind,
    example: AbandonmentKind.KYC_PENDING,
  })
  @IsOptional()
  @IsString()
  kind?: AbandonmentKind | string;

  @ApiPropertyOptional({
    description: 'Filter by abandonment event status',
    enum: AbandonmentEventStatus,
    example: AbandonmentEventStatus.ACTIVE,
  })
  @IsOptional()
  @IsString()
  status?: AbandonmentEventStatus | string;

  @ApiPropertyOptional({
    description: 'Maximum number of items to return',
    minimum: 1,
    maximum: 200,
    default: 50,
    example: 20,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}