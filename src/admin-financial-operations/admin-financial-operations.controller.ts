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
import { AdminFinancialOperationsService } from './admin-financial-operations.service';
import { ListAdminFinancialOperationsQueryDto } from './dto/list-admin-financial-operations-query.dto';
import { AdminFinancialOperationsSummaryResponseDto } from './dto/admin-financial-operations-summary-response.dto';
import { AdminFinancialOperationResponseDto } from './dto/admin-financial-operation-response.dto';

@ApiTags('Admin Financial Operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/financial-operations')
export class AdminFinancialOperationsController {
  constructor(
    private readonly adminFinancialOperationsService: AdminFinancialOperationsService,
  ) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Get financial operations queue summary',
    description:
      'Admin-only read model summarizing actionable payout, refund and financial control operations.',
  })
  @ApiOkResponse({ type: AdminFinancialOperationsSummaryResponseDto })
  async getSummary() {
    return this.adminFinancialOperationsService.getSummary();
  }

  @Get('queue')
  @ApiOperation({
    summary: 'List financial operations queue',
    description:
      'Admin-only unified operational queue for payouts, refunds and financial control exceptions.',
  })
  @ApiOkResponse({
    description: 'Paginated financial operations queue',
    type: AdminFinancialOperationResponseDto,
    isArray: true,
  })
  async listQueue(@Query() query: ListAdminFinancialOperationsQueryDto) {
    return this.adminFinancialOperationsService.listOperations(query);
  }
}