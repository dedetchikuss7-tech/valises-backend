import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { AdminDashboardSummaryService } from './admin-dashboard-summary.service';
import { GetAdminDashboardSummaryQueryDto } from './dto/get-admin-dashboard-summary-query.dto';
import { AdminDashboardSummaryResponseDto } from './dto/admin-dashboard-summary-response.dto';

@ApiTags('Admin Dashboard Summary')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/dashboard')
export class AdminDashboardSummaryController {
  constructor(private readonly service: AdminDashboardSummaryService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Get unified admin dashboard summary',
    description:
      'Admin-only endpoint returning consolidated operations counters and actionable previews across disputes, payouts, refunds, transactions and abandonment reminders.',
  })
  @ApiQuery({
    name: 'previewLimit',
    required: false,
    description: 'Maximum number of preview items per section',
    type: Number,
    example: 5,
  })
  @ApiOkResponse({
    description: 'Unified admin dashboard summary returned successfully.',
    type: AdminDashboardSummaryResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Admin role required.',
  })
  async getSummary(@Query() query: GetAdminDashboardSummaryQueryDto) {
    return this.service.getSummary(query);
  }
}