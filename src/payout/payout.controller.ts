import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PayoutService } from './payout.service';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { MarkPayoutPaidDto } from './dto/mark-payout-paid.dto';
import { MarkPayoutFailedDto } from './dto/mark-payout-failed.dto';

@ApiTags('Payout')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payouts')
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  private requester(req: any) {
    const userId = req?.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }

    return {
      userId,
      role: req.user.role,
    };
  }

  @Get('transactions/:transactionId')
  @ApiOperation({ summary: 'Get payout by transaction id' })
  async getByTransaction(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
  ) {
    return this.payoutService.getByTransaction(transactionId);
  }

  @Post('transactions/:transactionId/request')
  @ApiOperation({ summary: 'Request payout for a delivered transaction' })
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
  @ApiOperation({ summary: 'Mark payout as paid and debit escrow ledger' })
  async markPaid(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MarkPayoutPaidDto,
  ) {
    const requester = this.requester(req);

    return this.payoutService.markPaid(id, {
      externalReference: dto.externalReference ?? null,
      note: dto.note ?? null,
      actorUserId: requester.userId,
    });
  }

  @Post(':id/mark-failed')
  @ApiOperation({ summary: 'Mark payout as failed' })
  async markFailed(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MarkPayoutFailedDto,
  ) {
    return this.payoutService.markFailed(id, {
      reason: dto.reason,
    });
  }
}