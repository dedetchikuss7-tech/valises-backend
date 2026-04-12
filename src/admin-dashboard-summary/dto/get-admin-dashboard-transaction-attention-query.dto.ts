import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetAdminDashboardTransactionAttentionQueryDto {
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
  @IsIn(['transactionId', 'status'])
  sortBy?: 'transactionId' | 'status';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsIn(['true', 'false'])
  hasOpenDispute?: 'true' | 'false';

  @IsOptional()
  @IsIn(['true', 'false'])
  hasRequestedPayout?: 'true' | 'false';

  @IsOptional()
  @IsIn(['true', 'false'])
  hasRequestedRefund?: 'true' | 'false';
}