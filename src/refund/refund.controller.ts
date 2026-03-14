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
import { RefundService } from './refund.service';
import { MarkRefundFailedDto } from './dto/mark-refund-failed.dto';
import { MarkRefundedDto } from './dto/mark-refunded.dto';

@ApiTags('Refund')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('refunds')
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  @Get('transactions/:transactionId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get refund by transaction id (admin only)' })
  async getByTransaction(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
  ) {
    return this.refundService.getByTransaction(transactionId);
  }

  @Post(':id/mark-refunded')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Mark refund as refunded and debit escrow ledger (admin only)' })
  async markRefunded(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MarkRefundedDto,
  ) {
    return this.refundService.markRefunded(id, {
      externalReference: dto.externalReference ?? null,
      note: dto.note ?? null,
      actorUserId: null,
    });
  }

  @Post(':id/mark-failed')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Mark refund as failed (admin only)' })
  async markFailed(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MarkRefundFailedDto,
  ) {
    return this.refundService.markFailed(id, {
      reason: dto.reason,
    });
  }
}