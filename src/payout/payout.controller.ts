import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { MarkPayoutFailedDto } from './dto/mark-payout-failed.dto';
import { MarkPayoutPaidDto } from './dto/mark-payout-paid.dto';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { PayoutService } from './payout.service';

@ApiTags('Payouts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payouts')
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Get('transactions/:transactionId')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get payout by transaction id',
    description: 'Admin-only endpoint returning the payout attached to a transaction.',
  })
  @ApiParam({ name: 'transactionId', description: 'Transaction UUID' })
  async getByTransaction(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
  ) {
    return this.payoutService.getByTransaction(transactionId);
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get payout by payout id',
    description: 'Admin-only endpoint returning a payout and its linked transaction details.',
  })
  @ApiParam({ name: 'id', description: 'Payout UUID' })
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
  async requestPayout(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
    @Body() dto: RequestPayoutDto,
  ) {
    return this.payoutService.requestPayoutForTransaction(
      transactionId,
      dto.provider,
    );
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
  async markPaid(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MarkPayoutPaidDto,
  ) {
    return this.payoutService.markPaid(id, {
      externalReference: dto.externalReference ?? null,
      note: dto.note ?? null,
      actorUserId: null,
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
  async markFailed(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MarkPayoutFailedDto,
  ) {
    return this.payoutService.markFailed(id, {
      reason: dto.reason,
    });
  }
}