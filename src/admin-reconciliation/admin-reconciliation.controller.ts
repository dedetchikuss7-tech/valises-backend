import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminReconciliationService } from './admin-reconciliation.service';
import { AdminReconciliationCaseResponseDto } from './dto/admin-reconciliation-case-response.dto';
import { AdminReconciliationSummaryResponseDto } from './dto/admin-reconciliation-summary-response.dto';
import { ListAdminReconciliationCasesQueryDto } from './dto/list-admin-reconciliation-cases-query.dto';

@ApiTags('Admin Reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/reconciliation')
export class AdminReconciliationController {
  constructor(
    private readonly adminReconciliationService: AdminReconciliationService,
  ) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Get reconciliation summary',
    description:
      'Returns consolidated payout/refund reconciliation counts and derived status totals.',
  })
  @ApiOkResponse({
    description: 'Reconciliation summary',
    type: AdminReconciliationSummaryResponseDto,
  })
  async getSummary() {
    return this.adminReconciliationService.getSummary();
  }

  @Get('cases')
  @ApiOperation({
    summary: 'List reconciliation cases',
    description:
      'Returns consolidated payout/refund reconciliation rows with mismatch signals and derived statuses.',
  })
  @ApiOkResponse({
    description: 'Reconciliation case list',
    type: AdminReconciliationCaseResponseDto,
    isArray: true,
  })
  async listCases(@Query() query: ListAdminReconciliationCasesQueryDto) {
    return this.adminReconciliationService.listCases(query);
  }
}