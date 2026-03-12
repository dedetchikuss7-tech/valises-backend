import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { RefundService } from './refund.service';
import { ManualRefundProvider } from './providers/manual-refund.provider';
import { MockStripeRefundProvider } from './providers/mock-stripe-refund.provider';

@Module({
  imports: [PrismaModule, LedgerModule],
  providers: [
    RefundService,
    ManualRefundProvider,
    MockStripeRefundProvider,
  ],
  exports: [RefundService],
})
export class RefundModule {}