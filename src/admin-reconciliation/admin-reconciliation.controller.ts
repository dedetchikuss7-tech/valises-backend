import { Body, Controller, Get, Param, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BulkActionResultDto } from '../common/dto/bulk-action-result.dto';
import { BulkAdminReconciliationReviewDto } from './dto/bulk-admin-reconciliation-review.dto';
import { AdminReconciliationCaseResponseDto } from './dto/admin-reconciliation-case-response.dto';
import { AdminReconciliationSummaryResponseDto } from './dto/admin-reconciliation-summary-response.dto';
import { ListAdminReconciliationCasesQueryDto } from './dto/list-admin-reconciliation-cases-query.dto';
import { AdminReconciliationService } from './admin-reconciliation.service';
import { PspReconciliationService } from './psp-reconciliation.service';
import { TriggerPspReconciliationRunDto } from './dto/trigger-psp-reconciliation-run.dto';
import { PspReconciliationRunResponseDto } from './dto/psp-reconciliation-run-response.dto';
import { ListPspReconciliationRunsQueryDto } from './dto/list-psp-reconciliation-runs-query.dto';

@ApiTags('Admin Reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/reconciliation')
export class AdminReconciliationController {
  constructor(
    private readonly adminReconciliationService: AdminReconciliationService,
    private readonly pspReconciliationService: PspReconciliationService,
  ) {}

  private adminId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get reconciliation summary',
  })
  @ApiOkResponse({ type: AdminReconciliationSummaryResponseDto })
  async getSummary() {
    return this.adminReconciliationService.getSummary();
  }

  @Get('cases')
  @ApiOperation({
    summary: 'List reconciliation cases',
  })
  async listCases(@Query() query: ListAdminReconciliationCasesQueryDto) {
    return this.adminReconciliationService.listCases(query);
  }

  @Post('cases/bulk/review')
  @ApiOperation({
    summary: 'Bulk mark reconciliation rows as reviewed',
  })
  @ApiBody({ type: BulkAdminReconciliationReviewDto })
  @ApiOkResponse({ type: BulkActionResultDto })
  async bulkReview(
    @Req() req: any,
    @Body() body: BulkAdminReconciliationReviewDto,
  ) {
    return this.adminReconciliationService.bulkMarkReviewed(
      this.adminId(req),
      body,
    );
  }

  // ─── PSP Reconciliation Runs ─────────────────────────────────────────────

  @Post('psp-runs')
  @ApiOperation({
    summary: 'Trigger a PSP reconciliation run',
    description:
      'Compares local DB payment records against CinetPay API. Discrepancies create ReconciliationCase records. PSP is source of truth.',
  })
  @ApiBody({ type: TriggerPspReconciliationRunDto })
  @ApiCreatedResponse({ type: PspReconciliationRunResponseDto })
  async triggerPspRun(
    @Req() req: any,
    @Body() body: TriggerPspReconciliationRunDto,
  ): Promise<PspReconciliationRunResponseDto> {
    return this.pspReconciliationService.triggerRun(body, this.adminId(req));
  }

  @Get('psp-runs')
  @ApiOperation({ summary: 'List PSP reconciliation runs' })
  @ApiOkResponse({ type: PspReconciliationRunResponseDto, isArray: true })
  async listPspRuns(
    @Query() query: ListPspReconciliationRunsQueryDto,
  ) {
    return this.pspReconciliationService.listRuns(query);
  }

  @Get('psp-runs/:id')
  @ApiOperation({ summary: 'Get a PSP reconciliation run with its cases' })
  @ApiParam({ name: 'id', description: 'ReconciliationRun UUID' })
  @ApiOkResponse({ type: PspReconciliationRunResponseDto })
  async getPspRun(@Param('id') id: string): Promise<PspReconciliationRunResponseDto> {
    return this.pspReconciliationService.getRunById(id);
  }
}