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
import { MarkRefundFailedDto } from './dto/mark-refund-failed.dto';
import { MarkRefundedDto } from './dto/mark-refunded.dto';
import { RefundService } from './refund.service';
import { ListRefundsQueryDto } from './dto/list-refunds-query.dto';
import { RetryRefundDto } from './dto/retry-refund.dto';
import { RefundResponseDto } from './dto/refund-response.dto';
import { RefundWithTransactionResponseDto } from './dto/refund-with-transaction-response.dto';
import { IngestRefundProviderEventDto } from './dto/ingest-refund-provider-event.dto';

@ApiTags('Refunds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('refunds')
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'List refunds',
    description: 'Admin-only endpoint returning refunds with optional filters.',
  })
  @ApiQuery({ name: 'transactionId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'provider', required: false, type: String })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({
    description: 'List of refunds with linked transaction summary',
    type: RefundWithTransactionResponseDto,
    isArray: true,
  })
  async list(@Query() query: ListRefundsQueryDto) {
    return this.refundService.list(query);
  }

  @Get('transactions/:transactionId')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get refund by transaction id',
    description:
      'Admin-only endpoint returning the refund attached to a transaction.',
  })
  @ApiParam({ name: 'transactionId', description: 'Transaction UUID' })
  @ApiOkResponse({
    description: 'Refund attached to the transaction',
    type: RefundResponseDto,
  })
  async getByTransaction(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
  ) {
    return this.refundService.getByTransaction(transactionId);
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get refund by refund id',
    description:
      'Admin-only endpoint returning a refund and its linked transaction details.',
  })
  @ApiParam({ name: 'id', description: 'Refund UUID' })
  @ApiOkResponse({
    description: 'Refund with linked transaction summary',
    type: RefundWithTransactionResponseDto,
  })
  async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.refundService.getOne(id);
  }

  @Post('provider-events/ingest')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Ingest one refund provider event',
    description:
      'Admin-only operational ingestion endpoint for refund provider events. Persists the event idempotently and applies it to the refund when possible.',
  })
  @ApiBody({ type: IngestRefundProviderEventDto })
  @ApiOkResponse({
    description: 'Stored provider event and refund application result',
  })
  async ingestProviderEvent(
    @Body() dto: IngestRefundProviderEventDto,
    @Req() req?: any,
  ) {
    return this.refundService.ingestProviderEvent({
      provider: dto.provider,
      eventType: dto.eventType,
      idempotencyKey: dto.idempotencyKey,
      refundId: dto.refundId ?? null,
      transactionId: dto.transactionId ?? null,
      externalReference: dto.externalReference ?? null,
      occurredAt: dto.occurredAt ?? null,
      payload: dto.payload ?? {},
      actorUserId: req?.user?.userId ?? null,
    });
  }

  @Post('transactions/:transactionId/reconcile-provider-events')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Reconcile refund provider events for a transaction',
    description:
      'Admin-only endpoint reprocessing the latest unapplied refund provider event for a transaction when one exists.',
  })
  @ApiParam({ name: 'transactionId', description: 'Transaction UUID' })
  @ApiOkResponse({
    description: 'Reconciliation result for refund provider events',
  })
  async reconcileProviderEvents(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
    @Req() req?: any,
  ) {
    return this.refundService.reconcileProviderEventsForTransaction(
      transactionId,
      req?.user?.userId ?? null,
    );
  }

  @Post(':id/retry')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Retry refund',
    description:
      'Admin-only endpoint to retry a refund currently in FAILED or CANCELLED state.',
  })
  @ApiParam({ name: 'id', description: 'Refund UUID' })
  @ApiBody({ type: RetryRefundDto })
  @ApiOkResponse({
    description: 'Retried refund after provider dispatch',
    type: RefundResponseDto,
  })
  async retry(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RetryRefundDto,
    @Req() req?: any,
  ) {
    const actorUserId = req?.user?.userId;

    return this.refundService.retry(id, {
      provider: dto.provider,
      reason: dto.reason ?? null,
      ...(actorUserId !== undefined ? { actorUserId } : {}),
    });
  }

  @Post(':id/mark-refunded')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Mark refund as refunded',
    description:
      'Admin-only endpoint marking a refund as REFUNDED and debiting the escrow ledger accordingly.',
  })
  @ApiParam({ name: 'id', description: 'Refund UUID' })
  @ApiBody({ type: MarkRefundedDto })
  @ApiOkResponse({
    description: 'Refund marked as refunded',
    type: RefundResponseDto,
  })
  async markRefunded(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MarkRefundedDto,
    @Req() req?: any,
  ) {
    return this.refundService.markRefunded(id, {
      externalReference: dto.externalReference ?? null,
      note: dto.note ?? null,
      actorUserId: req?.user?.userId ?? null,
    });
  }

  @Post(':id/mark-failed')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Mark refund as failed',
    description:
      'Admin-only endpoint marking a refund as FAILED without debiting the escrow ledger.',
  })
  @ApiParam({ name: 'id', description: 'Refund UUID' })
  @ApiBody({ type: MarkRefundFailedDto })
  @ApiOkResponse({
    description: 'Refund marked as failed',
    type: RefundResponseDto,
  })
  async markFailed(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MarkRefundFailedDto,
    @Req() req?: any,
  ) {
    const actorUserId = req?.user?.userId;

    return this.refundService.markFailed(id, {
      reason: dto.reason,
      ...(actorUserId !== undefined ? { actorUserId } : {}),
    });
  }
}