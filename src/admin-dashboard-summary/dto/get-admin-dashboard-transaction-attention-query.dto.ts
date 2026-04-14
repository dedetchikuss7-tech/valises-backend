import { IsIn, IsOptional } from 'class-validator';
import { AdminDashboardPaginationQueryDto } from './admin-dashboard-pagination-query.dto';

export class GetAdminDashboardTransactionAttentionQueryDto extends AdminDashboardPaginationQueryDto {
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