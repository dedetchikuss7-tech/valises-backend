import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RefundProvider, RefundStatus } from '@prisma/client';

export class ListRefundsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by transaction ID',
    example: '459e66d1-121d-429b-82cc-163baf21b052',
  })
  @IsOptional()
  @IsUUID()
  transactionId?: string;

  @ApiPropertyOptional({
    enum: RefundStatus,
    description: 'Filter by refund status',
    example: RefundStatus.FAILED,
  })
  @IsOptional()
  @IsEnum(RefundStatus)
  status?: RefundStatus;

  @ApiPropertyOptional({
    enum: RefundProvider,
    description: 'Filter by refund provider',
    example: RefundProvider.MANUAL,
  })
  @IsOptional()
  @IsEnum(RefundProvider)
  provider?: RefundProvider;

  @ApiPropertyOptional({
    description: 'Created at greater than or equal to this ISO date',
    example: '2026-03-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Created at less than or equal to this ISO date',
    example: '2026-03-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    example: 50,
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}