import { IsIn, IsOptional, IsString } from 'class-validator';
import { RefundStatus } from '@prisma/client';
import { AdminDashboardPaginationQueryDto } from './admin-dashboard-pagination-query.dto';

export class GetAdminDashboardRefundsQueryDto extends AdminDashboardPaginationQueryDto {
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