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
import { GetAdminDashboardQueueQueryDto } from './dto/get-admin-dashboard-queue-query.dto';
import {
  AdminDashboardActionableReminderJobQueueItemDto,
  AdminDashboardOpenDisputeQueueItemDto,
  AdminDashboardPendingPayoutQueueItemDto,
  AdminDashboardPendingRefundQueueItemDto,
  AdminDashboardTransactionAttentionQueueItemDto,
} from './dto/admin-dashboard-queues-response.dto';

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

  @Get('queues/transactions-requiring-attention')
  @ApiOperation({
    summary: 'Get transaction attention queue',
    description:
      'Admin-only queue endpoint returning transactions requiring operational attention.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of queue items',
    type: Number,
    example: 20,
  })
  @ApiOkResponse({
    description: 'Transaction attention queue returned successfully.',
    type: AdminDashboardTransactionAttentionQueueItemDto,
    isArray: true,
  })
  async getTransactionsRequiringAttentionQueue(
    @Query() query: GetAdminDashboardQueueQueryDto,
  ) {
    return this.service.getTransactionsRequiringAttentionQueue(query);
  }

  @Get('queues/open-disputes')
  @ApiOperation({
    summary: 'Get open disputes queue',
    description: 'Admin-only queue endpoint returning open disputes.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of queue items',
    type: Number,
    example: 20,
  })
  @ApiOkResponse({
    description: 'Open disputes queue returned successfully.',
    type: AdminDashboardOpenDisputeQueueItemDto,
    isArray: true,
  })
  async getOpenDisputesQueue(@Query() query: GetAdminDashboardQueueQueryDto) {
    return this.service.getOpenDisputesQueue(query);
  }

  @Get('queues/pending-payouts')
  @ApiOperation({
    summary: 'Get pending payouts queue',
    description:
      'Admin-only queue endpoint returning payouts in REQUESTED or PROCESSING status.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of queue items',
    type: Number,
    example: 20,
  })
  @ApiOkResponse({
    description: 'Pending payouts queue returned successfully.',
    type: AdminDashboardPendingPayoutQueueItemDto,
    isArray: true,
  })
  async getPendingPayoutsQueue(@Query() query: GetAdminDashboardQueueQueryDto) {
    return this.service.getPendingPayoutsQueue(query);
  }

  @Get('queues/pending-refunds')
  @ApiOperation({
    summary: 'Get pending refunds queue',
    description:
      'Admin-only queue endpoint returning refunds in REQUESTED or PROCESSING status.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of queue items',
    type: Number,
    example: 20,
  })
  @ApiOkResponse({
    description: 'Pending refunds queue returned successfully.',
    type: AdminDashboardPendingRefundQueueItemDto,
    isArray: true,
  })
  async getPendingRefundsQueue(@Query() query: GetAdminDashboardQueueQueryDto) {
    return this.service.getPendingRefundsQueue(query);
  }

  @Get('queues/actionable-reminder-jobs')
  @ApiOperation({
    summary: 'Get actionable reminder jobs queue',
    description:
      'Admin-only queue endpoint returning reminder jobs that need operational attention.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of queue items',
    type: Number,
    example: 20,
  })
  @ApiOkResponse({
    description: 'Actionable reminder jobs queue returned successfully.',
    type: AdminDashboardActionableReminderJobQueueItemDto,
    isArray: true,
  })
  async getActionableReminderJobsQueue(
    @Query() query: GetAdminDashboardQueueQueryDto,
  ) {
    return this.service.getActionableReminderJobsQueue(query);
  }
}