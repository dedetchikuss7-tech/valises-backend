import { IsIn, IsOptional, IsString } from 'class-validator';
import { AdminDashboardPaginationQueryDto } from './admin-dashboard-pagination-query.dto';

export class GetAdminDashboardActivityQueryDto extends AdminDashboardPaginationQueryDto {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  targetType?: string;

  @IsOptional()
  @IsString()
  actorUserId?: string;

  @IsOptional()
  @IsIn(['createdAt', 'action', 'targetType'])
  sortBy?: 'createdAt' | 'action' | 'targetType';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}