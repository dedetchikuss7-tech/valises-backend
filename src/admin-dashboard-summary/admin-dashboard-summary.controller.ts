import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { AdminDashboardSummaryService } from './admin-dashboard-summary.service';
import { GetAdminDashboardSummaryQueryDto } from './dto/get-admin-dashboard-summary-query.dto';
import { AdminDashboardSummaryResponseDto } from './dto/admin-dashboard-summary-response.dto';
import { GetAdminDashboardQueueQueryDto } from './dto/get-admin-dashboard-queue-query.dto';
import { GetAdminDashboardActivityQueryDto } from './dto/get-admin-dashboard-activity-query.dto';
import { AdminDashboardActivityItemDto } from './dto/admin-dashboard-activity-response.dto';
import {
  AdminDashboardActionableReminderJobQueueItemDto,
  AdminDashboardOpenDisputeQueueItemDto,
  AdminDashboardPendingPayoutQueueItemDto,
  AdminDashboardPendingRefundQueueItemDto,
  AdminDashboardTransactionAttentionQueueItemDto,
} from './dto/admin-dashboard-queues-response.dto';
import { AdminDashboardBulkActionResultDto } from './dto/admin-dashboard-bulk-action-result.dto';
import { BulkDashboardCompleteItemsDto } from './dto/bulk-dashboard-complete-items.dto';
import { BulkDashboardMarkFailedDto } from './dto/bulk-dashboard-mark-failed.dto';
import { BulkDashboardResolveDisputesDto } from './dto/bulk-dashboard-resolve-disputes.dto';

@ApiTags('Admin Dashboard Summary')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/dashboard')
export class AdminDashboardSummaryController {
  constructor(private readonly service: AdminDashboardSummaryService) {}

  private extractActorUserId(req: Request) {
    const userId = (req as any)?.user?.userId ?? null;
    if (!userId) {
      throw new UnauthorizedException('JWT userId is required');
    }
    return userId as string;
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get unified admin dashboard summary' })
  @ApiQuery({
    name: 'previewLimit',
    required: false,
    type: Number,
    example: 5,
  })
  @ApiOkResponse({
    type: AdminDashboardSummaryResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Admin role required.' })
  async getSummary(@Query() query: GetAdminDashboardSummaryQueryDto) {
    return this.service.getSummary(query);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get recent admin dashboard activity feed' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'action', required: false, type: String, example: 'DISPUTE_RESOLVED' })
  @ApiQuery({ name: 'targetType', required: false, type: String, example: 'DISPUTE' })
  @ApiQuery({ name: 'actorUserId', required: false, type: String, example: 'user_123' })
  @ApiOkResponse({
    type: AdminDashboardActivityItemDto,
    isArray: true,
  })
  async getActivity(@Query() query: GetAdminDashboardActivityQueryDto) {
    return this.service.getActivity(query);
  }

  @Get('queues/transactions-requiring-attention')
  @ApiOperation({ summary: 'Get transaction attention queue' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiOkResponse({
    type: AdminDashboardTransactionAttentionQueueItemDto,
    isArray: true,
  })
  async getTransactionsRequiringAttentionQueue(
    @Query() query: GetAdminDashboardQueueQueryDto,
  ) {
    return this.service.getTransactionsRequiringAttentionQueue(query);
  }

  @Get('queues/open-disputes')
  @ApiOperation({ summary: 'Get open disputes queue' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiOkResponse({
    type: AdminDashboardOpenDisputeQueueItemDto,
    isArray: true,
  })
  async getOpenDisputesQueue(@Query() query: GetAdminDashboardQueueQueryDto) {
    return this.service.getOpenDisputesQueue(query);
  }

  @Get('queues/pending-payouts')
  @ApiOperation({ summary: 'Get pending payouts queue' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiOkResponse({
    type: AdminDashboardPendingPayoutQueueItemDto,
    isArray: true,
  })
  async getPendingPayoutsQueue(@Query() query: GetAdminDashboardQueueQueryDto) {
    return this.service.getPendingPayoutsQueue(query);
  }

  @Get('queues/pending-refunds')
  @ApiOperation({ summary: 'Get pending refunds queue' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiOkResponse({
    type: AdminDashboardPendingRefundQueueItemDto,
    isArray: true,
  })
  async getPendingRefundsQueue(@Query() query: GetAdminDashboardQueueQueryDto) {
    return this.service.getPendingRefundsQueue(query);
  }

  @Get('queues/actionable-reminder-jobs')
  @ApiOperation({ summary: 'Get actionable reminder jobs queue' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiOkResponse({
    type: AdminDashboardActionableReminderJobQueueItemDto,
    isArray: true,
  })
  async getActionableReminderJobsQueue(
    @Query() query: GetAdminDashboardQueueQueryDto,
  ) {
    return this.service.getActionableReminderJobsQueue(query);
  }

  @Post('actions/payouts/mark-paid-many')
  @ApiOperation({ summary: 'Mark many payouts as paid' })
  @ApiOkResponse({ type: AdminDashboardBulkActionResultDto })
  async bulkMarkPayoutsPaid(
    @Body() dto: BulkDashboardCompleteItemsDto,
    @Req() req: Request,
  ) {
    return this.service.bulkMarkPayoutsPaid(dto, this.extractActorUserId(req));
  }

  @Post('actions/payouts/mark-failed-many')
  @ApiOperation({ summary: 'Mark many payouts as failed' })
  @ApiOkResponse({ type: AdminDashboardBulkActionResultDto })
  async bulkMarkPayoutsFailed(
    @Body() dto: BulkDashboardMarkFailedDto,
    @Req() req: Request,
  ) {
    return this.service.bulkMarkPayoutsFailed(dto, this.extractActorUserId(req));
  }

  @Post('actions/refunds/mark-refunded-many')
  @ApiOperation({ summary: 'Mark many refunds as refunded' })
  @ApiOkResponse({ type: AdminDashboardBulkActionResultDto })
  async bulkMarkRefundsRefunded(
    @Body() dto: BulkDashboardCompleteItemsDto,
    @Req() req: Request,
  ) {
    return this.service.bulkMarkRefundsRefunded(
      dto,
      this.extractActorUserId(req),
    );
  }

  @Post('actions/refunds/mark-failed-many')
  @ApiOperation({ summary: 'Mark many refunds as failed' })
  @ApiOkResponse({ type: AdminDashboardBulkActionResultDto })
  async bulkMarkRefundsFailed(
    @Body() dto: BulkDashboardMarkFailedDto,
    @Req() req: Request,
  ) {
    return this.service.bulkMarkRefundsFailed(dto, this.extractActorUserId(req));
  }

  @Post('actions/disputes/resolve-many')
  @ApiOperation({ summary: 'Resolve many disputes' })
  @ApiOkResponse({ type: AdminDashboardBulkActionResultDto })
  async bulkResolveDisputes(
    @Body() dto: BulkDashboardResolveDisputesDto,
    @Req() req: Request,
  ) {
    return this.service.bulkResolveDisputes(dto, this.extractActorUserId(req));
  }
}