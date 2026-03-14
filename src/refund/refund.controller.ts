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
import { MarkRefundFailedDto } from './dto/mark-refund-failed.dto';
import { MarkRefundedDto } from './dto/mark-refunded.dto';
import { RefundService } from './refund.service';

@ApiTags('Refunds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('refunds')
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  @Get('transactions/:transactionId')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get refund by transaction id',
    description: 'Admin-only endpoint returning the refund attached to a transaction.',
  })
  @ApiParam({ name: 'transactionId', description: 'Transaction UUID' })
  async getByTransaction(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
  ) {
    return this.refundService.getByTransaction(transactionId);
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
  @ApiOperation({
    summary: 'Mark refund as failed',
    description:
      'Admin-only endpoint marking a refund as FAILED without debiting the escrow ledger.',
  })
  @ApiParam({ name: 'id', description: 'Refund UUID' })
  @ApiBody({ type: MarkRefundFailedDto })
  async markFailed(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MarkRefundFailedDto,
  ) {
    return this.refundService.markFailed(id, {
      reason: dto.reason,
    });
  }
}