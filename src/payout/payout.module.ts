import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PayoutController } from './payout.controller';
import { PayoutService } from './payout.service';
import { ManualPayoutProvider } from './providers/manual-payout.provider';
import { MockStripePayoutProvider } from './providers/mock-stripe-payout.provider';

@Module({
  imports: [PrismaModule, LedgerModule],
  controllers: [PayoutController],
  providers: [
    PayoutService,
    ManualPayoutProvider,
    MockStripePayoutProvider,
  ],
  exports: [PayoutService],
})
export class PayoutModule {}