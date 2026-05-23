import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminFinanceService } from './admin-finance.service';
import {
  BalanceMismatchDto,
  FinanceSummaryDto,
  OrphanTransactionDto,
  PspReconciliationReportDto,
} from './dto/finance-summary.dto';

@ApiTags('Admin Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin-finance')
export class AdminFinanceController {
  constructor(private readonly adminFinanceService: AdminFinanceService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Finance summary — escrow, payouts, revenue' })
  @ApiOkResponse({ type: FinanceSummaryDto })
  getFinanceSummary(): Promise<FinanceSummaryDto> {
    return this.adminFinanceService.getFinanceSummary();
  }

  @Get('orphan-transactions')
  @ApiOperation({
    summary: 'Transactions paid >48h ago with no associated payout',
  })
  @ApiOkResponse({ type: [OrphanTransactionDto] })
  getOrphanTransactions(): Promise<OrphanTransactionDto[]> {
    return this.adminFinanceService.getOrphanTransactions();
  }

  @Get('balance-mismatches')
  @ApiOperation({
    summary: 'Transactions where escrowAmount differs from amount',
  })
  @ApiOkResponse({ type: [BalanceMismatchDto] })
  getBalanceMismatches(): Promise<BalanceMismatchDto[]> {
    return this.adminFinanceService.getBalanceMismatches();
  }

  @Get('psp-reconciliation')
  @ApiOperation({
    summary:
      'PSP reconciliation report — transactions with payment + payout/refund status',
  })
  @ApiQuery({ name: 'dateFrom', required: true, example: '2026-01-01' })
  @ApiQuery({ name: 'dateTo', required: true, example: '2026-01-31' })
  @ApiOkResponse({ type: PspReconciliationReportDto })
  getPspReconciliation(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ): Promise<PspReconciliationReportDto> {
    return this.adminFinanceService.getPspReconciliationReport(dateFrom, dateTo);
  }
}
