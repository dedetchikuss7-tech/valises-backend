import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { RefundStatus } from '@prisma/client';

export class GetAdminDashboardRefundsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsIn(['createdAt', 'amount', 'currency', 'status'])
  sortBy?: 'createdAt' | 'amount' | 'currency' | 'status';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsIn(Object.values(RefundStatus))
  status?: RefundStatus;

  @IsOptional()
  @IsString()
  currency?: string;
}