import { IsIn, IsOptional, IsString } from 'class-validator';
import { PayoutStatus } from '@prisma/client';
import { AdminDashboardPaginationQueryDto } from './admin-dashboard-pagination-query.dto';

export class GetAdminDashboardPayoutsQueryDto extends AdminDashboardPaginationQueryDto {
  @IsOptional()
  @IsIn(['createdAt', 'amount', 'currency', 'status'])
  sortBy?: 'createdAt' | 'amount' | 'currency' | 'status';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsIn(Object.values(PayoutStatus))
  status?: PayoutStatus;

  @IsOptional()
  @IsString()
  currency?: string;
}