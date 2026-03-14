import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PayoutService } from './payout.service';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { MarkPayoutPaidDto } from './dto/mark-payout-paid.dto';
import { MarkPayoutFailedDto } from './dto/mark-payout-failed.dto';

@ApiTags('Payout')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payouts')
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Get('transactions/:transactionId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get payout by transaction id (admin only)' })
  async getByTransaction(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
  ) {
    return this.payoutService.getByTransaction(transactionId);
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get payout by payout id (admin only)' })
  async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.payoutService.getOne(id);
  }

  @Post('transactions/:transactionId/request')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Request payout for a transaction (admin only)' })
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
  @ApiOperation({ summary: 'Mark payout as paid and debit escrow ledger (admin only)' })
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
  @ApiOperation({ summary: 'Mark payout as failed (admin only)' })
  async markFailed(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MarkPayoutFailedDto,
  ) {
    return this.payoutService.markFailed(id, {
      reason: dto.reason,
    });
  }
}