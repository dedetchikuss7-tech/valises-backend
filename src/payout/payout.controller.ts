import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { MarkPayoutFailedDto } from './dto/mark-payout-failed.dto';
import { MarkPayoutPaidDto } from './dto/mark-payout-paid.dto';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { PayoutService } from './payout.service';
import { ListPayoutsQueryDto } from './dto/list-payouts-query.dto';
import { RetryPayoutDto } from './dto/retry-payout.dto';
import { PayoutResponseDto } from './dto/payout-response.dto';
import { PayoutWithTransactionResponseDto } from './dto/payout-with-transaction-response.dto';

@ApiTags('Payouts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payouts')
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'List payouts',
    description: 'Admin-only endpoint returning payouts with optional filters.',
  })
  @ApiQuery({ name: 'transactionId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'provider', required: false, type: String })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({
    description: 'List of payouts with linked transaction summary',
    type: PayoutWithTransactionResponseDto,
    isArray: true,
  })
  async list(@Query() query: ListPayoutsQueryDto) {
    return this.payoutService.list(query);
  }

  @Get('transactions/:transactionId')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get payout by transaction id',
    description:
      'Admin-only endpoint returning the payout attached to a transaction.',
  })
  @ApiParam({ name: 'transactionId', description: 'Transaction UUID' })
  @ApiOkResponse({
    description: 'Payout attached to the transaction',
    type: PayoutResponseDto,
  })
  async getByTransaction(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
  ) {
    return this.payoutService.getByTransaction(transactionId);
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get payout by payout id',
    description:
      'Admin-only endpoint returning a payout and its linked transaction details.',
  })
  @ApiParam({ name: 'id', description: 'Payout UUID' })
  @ApiOkResponse({
    description: 'Payout with linked transaction summary',
    type: PayoutWithTransactionResponseDto,
  })
  async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.payoutService.getOne(id);
  }

  @Post('transactions/:transactionId/request')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Request payout for transaction',
    description:
      'Admin-only endpoint to initiate payout orchestration for a transaction with available escrow.',
  })
  @ApiParam({ name: 'transactionId', description: 'Transaction UUID' })
  @ApiBody({ type: RequestPayoutDto })
  @ApiOkResponse({
    description: 'Created or refreshed payout request',
    type: PayoutResponseDto,
  })
  async requestPayout(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
    @Body() dto: RequestPayoutDto,
  ) {
    return this.payoutService.requestPayoutForTransaction(
      transactionId,
      dto.provider,
    );
  }

  @Post(':id/retry')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Retry payout',
    description:
      'Admin-only endpoint to retry a payout currently in FAILED or CANCELLED state.',
  })
  @ApiParam({ name: 'id', description: 'Payout UUID' })
  @ApiBody({ type: RetryPayoutDto })
  @ApiOkResponse({
    description: 'Retried payout after provider dispatch',
    type: PayoutResponseDto,
  })
  async retry(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RetryPayoutDto,
    @Req() req?: any,
  ) {
    const actorUserId = req?.user?.userId;

    return this.payoutService.retry(id, {
      provider: dto.provider,
      reason: dto.reason ?? null,
      ...(actorUserId !== undefined ? { actorUserId } : {}),
    });
  }

  @Post(':id/mark-paid')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Mark payout as paid',
    description:
      'Admin-only endpoint marking a payout as PAID and debiting the escrow ledger accordingly.',
  })
  @ApiParam({ name: 'id', description: 'Payout UUID' })
  @ApiBody({ type: MarkPayoutPaidDto })
  @ApiOkResponse({
    description: 'Payout marked as paid',
    type: PayoutResponseDto,
  })
  async markPaid(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MarkPayoutPaidDto,
    @Req() req?: any,
  ) {
    return this.payoutService.markPaid(id, {
      externalReference: dto.externalReference ?? null,
      note: dto.note ?? null,
      actorUserId: req?.user?.userId ?? null,
    });
  }

  @Post(':id/mark-failed')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Mark payout as failed',
    description:
      'Admin-only endpoint marking a payout as FAILED without releasing escrow.',
  })
  @ApiParam({ name: 'id', description: 'Payout UUID' })
  @ApiBody({ type: MarkPayoutFailedDto })
  @ApiOkResponse({
    description: 'Payout marked as failed',
    type: PayoutResponseDto,
  })
  async markFailed(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MarkPayoutFailedDto,
    @Req() req?: any,
  ) {
    const actorUserId = req?.user?.userId;

    return this.payoutService.markFailed(id, {
      reason: dto.reason,
      ...(actorUserId !== undefined ? { actorUserId } : {}),
    });
  }
}