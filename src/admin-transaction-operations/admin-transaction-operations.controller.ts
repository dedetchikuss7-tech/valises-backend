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
import { AdminTransactionOperationsQueryDto } from './dto/admin-transaction-operations-query.dto';
import { AdminTransactionOperationItemDto } from './dto/admin-transaction-operation-item.dto';
import { AdminTransactionOperationsSummaryDto } from './dto/admin-transaction-operations-summary.dto';
import { AdminTransactionOperationsService } from './admin-transaction-operations.service';

@ApiTags('Admin Transaction Operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/transaction-operations')
export class AdminTransactionOperationsController {
  constructor(
    private readonly adminTransactionOperationsService: AdminTransactionOperationsService,
  ) {}

  @Get('queue')
  @ApiOperation({
    summary: 'List transaction operational queue',
    description:
      'Admin-only read model aggregating transaction, dispute, evidence, payout, refund and trust restriction signals.',
  })
  @ApiOkResponse({
    description: 'Transaction operational queue',
    type: AdminTransactionOperationItemDto,
    isArray: true,
  })
  async listQueue(@Query() query: AdminTransactionOperationsQueryDto) {
    return this.adminTransactionOperationsService.listQueue(query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get transaction operational queue summary',
  })
  @ApiOkResponse({
    type: AdminTransactionOperationsSummaryDto,
  })
  async getSummary() {
    return this.adminTransactionOperationsService.getSummary();
  }
}