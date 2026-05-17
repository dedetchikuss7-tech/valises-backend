import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { AdminTransactionOperationsService } from './admin-transaction-operations.service';
import { AdminTransactionOperationalCaseResponseDto } from './dto/admin-transaction-operational-case-response.dto';
import { UpdateAdminTransactionOperationalCaseDto } from './dto/update-admin-transaction-operational-case.dto';
import { ResolveAdminTransactionOperationalCaseDto } from './dto/resolve-admin-transaction-operational-case.dto';
import { ReopenAdminTransactionOperationalCaseDto } from './dto/reopen-admin-transaction-operational-case.dto';

@ApiTags('Admin Transaction Operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/transaction-operations')
export class AdminTransactionOperationsController {
  constructor(
    private readonly adminTransactionOperationsService: AdminTransactionOperationsService,
  ) {}

  private userId(req: any): string {
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
      'Admin-only read model aggregating transaction, dispute, evidence, payout, refund, trust restriction and operational case lifecycle signals.',
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
      'Admin-only detailed operational view for one transaction, including queue signals, lifecycle, evidence, disputes, payout, refund, AML, user restrictions and operational case status.',
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
      'Admin-only endpoint that returns the operational case for a transaction or creates it if missing.',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'Transaction UUID',
  })
  @ApiOkResponse({
    type: AdminTransactionOperationalCaseResponseDto,
  })
  async getOperationalCase(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
    @Req() req: any,
  ) {
    return this.adminTransactionOperationsService.getOperationalCase(
      transactionId,
      this.userId(req),
    );
  }

  @Patch('transactions/:transactionId/case')
  @ApiOperation({
    summary: 'Update transaction operational case',
    description:
      'Admin-only endpoint updating assignment, status, priority and note for a transaction operational case.',
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
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
    @Body() dto: UpdateAdminTransactionOperationalCaseDto,
    @Req() req: any,
  ) {
    return this.adminTransactionOperationsService.updateOperationalCase(
      transactionId,
      this.userId(req),
      dto,
    );
  }

  @Post('transactions/:transactionId/case/resolve')
  @ApiOperation({
    summary: 'Resolve transaction operational case',
    description:
      'Admin-only endpoint marking the operational case as resolved without changing the transaction, payout, refund, dispute, AML or ledger lifecycle.',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'Transaction UUID',
  })
  @ApiBody({ type: ResolveAdminTransactionOperationalCaseDto })
  @ApiOkResponse({
    type: AdminTransactionOperationalCaseResponseDto,
  })
  async resolveOperationalCase(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
    @Body() dto: ResolveAdminTransactionOperationalCaseDto,
    @Req() req: any,
  ) {
    return this.adminTransactionOperationsService.resolveOperationalCase(
      transactionId,
      this.userId(req),
      dto,
    );
  }

  @Post('transactions/:transactionId/case/reopen')
  @ApiOperation({
    summary: 'Reopen transaction operational case',
    description:
      'Admin-only endpoint reopening an operational case after new information or renewed ops attention.',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'Transaction UUID',
  })
  @ApiBody({ type: ReopenAdminTransactionOperationalCaseDto })
  @ApiOkResponse({
    type: AdminTransactionOperationalCaseResponseDto,
  })
  async reopenOperationalCase(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
    @Body() dto: ReopenAdminTransactionOperationalCaseDto,
    @Req() req: any,
  ) {
    return this.adminTransactionOperationsService.reopenOperationalCase(
      transactionId,
      this.userId(req),
      dto,
    );
  }
}