import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { PaymentAttemptService } from './payment-attempt.service';

@ApiTags('admin-payment-attempts')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/transactions')
export class PaymentAttemptController {
  constructor(private readonly paymentAttemptService: PaymentAttemptService) {}

  @Get(':id/payment-attempts')
  @ApiOperation({ summary: 'Get all payment attempts for a transaction' })
  async getAttempts(@Param('id') transactionId: string) {
    return this.paymentAttemptService.getAttemptsForTransaction(transactionId);
  }
}
