import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { FraudModule } from '../fraud/fraud.module';
import { PayoutController } from './payout.controller';
import { PayoutService } from './payout.service';
import { ManualPayoutProvider } from './providers/manual-payout.provider';
import { MockStripePayoutProvider } from './providers/mock-stripe-payout.provider';
import { PayoutAutoService } from './payout-auto.service';
import { PayoutAutoController } from './payout-auto.controller';
import { PayoutAutoScheduler } from './payout-auto.scheduler';

@Module({
  imports: [PrismaModule, LedgerModule, FraudModule],
  controllers: [PayoutController, PayoutAutoController],
  providers: [
    PayoutService,
    ManualPayoutProvider,
    MockStripePayoutProvider,
    PayoutAutoService,
    PayoutAutoScheduler,
  ],
  exports: [PayoutService, PayoutAutoService],
})
export class PayoutModule {}
