import { Body, Controller, Get, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
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

@ApiTags('Admin Reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/reconciliation')
export class AdminReconciliationController {
  constructor(
    private readonly adminReconciliationService: AdminReconciliationService,
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
}