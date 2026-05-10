import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminTransactionOperationsQueryDto } from './dto/admin-transaction-operations-query.dto';
import { AdminTransactionOperationItemDto } from './dto/admin-transaction-operation-item.dto';
import { AdminTransactionOperationDetailDto } from './dto/admin-transaction-operation-detail.dto';
import { AdminTransactionOperationsSummaryDto } from './dto/admin-transaction-operations-summary.dto';
import { AdminTransactionOperationalCaseResponseDto } from './dto/admin-transaction-operational-case-response.dto';
import { UpdateAdminTransactionOperationalCaseDto } from './dto/update-admin-transaction-operational-case.dto';
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

  private adminId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

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

  @Get('transactions/:transactionId')
  @ApiOperation({
    summary: 'Get transaction operational drilldown',
    description:
      'Admin-only detailed operational view for one transaction, including queue signals, lifecycle, evidence, disputes, payout, refund, AML and user restrictions.',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'Transaction UUID',
  })
  @ApiOkResponse({
    type: AdminTransactionOperationDetailDto,
  })
  async getTransactionDetail(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
  ) {
    return this.adminTransactionOperationsService.getTransactionDetail(
      transactionId,
    );
  }

  @Get('transactions/:transactionId/case')
  @ApiOperation({
    summary: 'Get or create transaction operational case',
    description:
      'Admin-only operational case backed by AdminOwnership. This does not change transaction, payment, payout, refund, AML or evidence lifecycle state.',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'Transaction UUID',
  })
  @ApiOkResponse({
    type: AdminTransactionOperationalCaseResponseDto,
  })
  async getOperationalCase(
    @Req() req: any,
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
  ) {
    return this.adminTransactionOperationsService.getOperationalCase(
      transactionId,
      this.adminId(req),
    );
  }

  @Patch('transactions/:transactionId/case')
  @ApiOperation({
    summary: 'Update transaction operational case',
    description:
      'Admin-only operational action endpoint. Records AdminOwnership updates, AdminActionAudit, and AdminTimelineEvent. It does not mutate financial or business lifecycle state.',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'Transaction UUID',
  })
  @ApiBody({ type: UpdateAdminTransactionOperationalCaseDto })
  @ApiOkResponse({
    type: AdminTransactionOperationalCaseResponseDto,
  })
  async updateOperationalCase(
    @Req() req: any,
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
    @Body() body: UpdateAdminTransactionOperationalCaseDto,
  ) {
    return this.adminTransactionOperationsService.updateOperationalCase(
      transactionId,
      this.adminId(req),
      body,
    );
  }
}