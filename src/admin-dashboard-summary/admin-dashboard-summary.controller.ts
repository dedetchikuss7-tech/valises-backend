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
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { AdminDashboardSummaryService } from './admin-dashboard-summary.service';
import { GetAdminDashboardSummaryQueryDto } from './dto/get-admin-dashboard-summary-query.dto';
import { AdminDashboardSummaryResponseDto } from './dto/admin-dashboard-summary-response.dto';
import { GetAdminDashboardActivityQueryDto } from './dto/get-admin-dashboard-activity-query.dto';
import { GetAdminDashboardTransactionAttentionQueryDto } from './dto/get-admin-dashboard-transaction-attention-query.dto';
import { GetAdminDashboardOpenDisputesQueryDto } from './dto/get-admin-dashboard-open-disputes-query.dto';
import { GetAdminDashboardPayoutsQueryDto } from './dto/get-admin-dashboard-payouts-query.dto';
import { GetAdminDashboardRefundsQueryDto } from './dto/get-admin-dashboard-refunds-query.dto';
import { GetAdminDashboardReminderJobsQueryDto } from './dto/get-admin-dashboard-reminder-jobs-query.dto';
import { AdminDashboardActivityPageResponseDto } from './dto/admin-dashboard-activity-page-response.dto';
import { AdminDashboardTransactionAttentionPageResponseDto } from './dto/admin-dashboard-transaction-attention-page-response.dto';
import { AdminDashboardOpenDisputesPageResponseDto } from './dto/admin-dashboard-open-disputes-page-response.dto';
import { AdminDashboardPayoutsPageResponseDto } from './dto/admin-dashboard-payouts-page-response.dto';
import { AdminDashboardRefundsPageResponseDto } from './dto/admin-dashboard-refunds-page-response.dto';
import { AdminDashboardReminderJobsPageResponseDto } from './dto/admin-dashboard-reminder-jobs-page-response.dto';
import { AdminDashboardBulkActionResultDto } from './dto/admin-dashboard-bulk-action-result.dto';
import { BulkDashboardCompleteItemsDto } from './dto/bulk-dashboard-complete-items.dto';
import { BulkDashboardItemIdsDto } from './dto/bulk-dashboard-item-ids.dto';
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
  @ApiOkResponse({
    type: AdminDashboardSummaryResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Admin role required.' })
  async getSummary(@Query() query: GetAdminDashboardSummaryQueryDto) {
    return this.service.getSummary(query);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get recent admin dashboard activity feed' })
  @ApiOkResponse({ type: AdminDashboardActivityPageResponseDto })
  async getActivity(@Query() query: GetAdminDashboardActivityQueryDto) {
    return this.service.getActivity(query);
  }

  @Get('queues/transactions-requiring-attention')
  @ApiOperation({ summary: 'Get transaction attention queue' })
  @ApiOkResponse({
    type: AdminDashboardTransactionAttentionPageResponseDto,
  })
  async getTransactionsRequiringAttentionQueue(
    @Query() query: GetAdminDashboardTransactionAttentionQueryDto,
  ) {
    return this.service.getTransactionsRequiringAttentionQueue(query);
  }

  @Get('queues/open-disputes')
  @ApiOperation({ summary: 'Get open disputes queue' })
  @ApiOkResponse({
    type: AdminDashboardOpenDisputesPageResponseDto,
  })
  async getOpenDisputesQueue(
    @Query() query: GetAdminDashboardOpenDisputesQueryDto,
  ) {
    return this.service.getOpenDisputesQueue(query);
  }

  @Get('queues/pending-payouts')
  @ApiOperation({ summary: 'Get pending payouts queue' })
  @ApiOkResponse({
    type: AdminDashboardPayoutsPageResponseDto,
  })
  async getPendingPayoutsQueue(@Query() query: GetAdminDashboardPayoutsQueryDto) {
    return this.service.getPendingPayoutsQueue(query);
  }

  @Get('queues/pending-refunds')
  @ApiOperation({ summary: 'Get pending refunds queue' })
  @ApiOkResponse({
    type: AdminDashboardRefundsPageResponseDto,
  })
  async getPendingRefundsQueue(@Query() query: GetAdminDashboardRefundsQueryDto) {
    return this.service.getPendingRefundsQueue(query);
  }

  @Get('queues/actionable-reminder-jobs')
  @ApiOperation({ summary: 'Get actionable reminder jobs queue' })
  @ApiOkResponse({
    type: AdminDashboardReminderJobsPageResponseDto,
  })
  async getActionableReminderJobsQueue(
    @Query() query: GetAdminDashboardReminderJobsQueryDto,
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

  @Post('actions/reminder-jobs/trigger-many')
  @ApiOperation({ summary: 'Trigger many reminder jobs' })
  @ApiOkResponse({ type: AdminDashboardBulkActionResultDto })
  async bulkTriggerReminderJobs(@Body() dto: BulkDashboardItemIdsDto) {
    return this.service.bulkTriggerReminderJobs(dto);
  }

  @Post('actions/reminder-jobs/cancel-many')
  @ApiOperation({ summary: 'Cancel many reminder jobs' })
  @ApiOkResponse({ type: AdminDashboardBulkActionResultDto })
  async bulkCancelReminderJobs(@Body() dto: BulkDashboardItemIdsDto) {
    return this.service.bulkCancelReminderJobs(dto);
  }

  @Post('actions/reminder-jobs/retry-many')
  @ApiOperation({ summary: 'Retry many reminder jobs' })
  @ApiOkResponse({ type: AdminDashboardBulkActionResultDto })
  async bulkRetryReminderJobs(@Body() dto: BulkDashboardItemIdsDto) {
    return this.service.bulkRetryReminderJobs(dto);
  }
}