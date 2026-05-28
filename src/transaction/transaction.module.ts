import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AbandonmentModule } from '../abandonment/abandonment.module';
import { PayoutModule } from '../payout/payout.module';
import { EnforcementModule } from '../enforcement/enforcement.module';
import { TrustModule } from '../trust/trust.module';
import { LegalModule } from '../legal/legal.module';
import { PaymentModule } from '../payment/payment.module';
import { PushModule } from '../push/push.module';
import { FraudModule } from '../fraud/fraud.module';
import { CurrenciesModule } from '../currencies/currencies.module';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';

@Module({
  imports: [
    PrismaModule,
    LedgerModule,
    AbandonmentModule,
    PayoutModule,
    EnforcementModule,
    TrustModule,
    LegalModule,
    PaymentModule,
    PushModule,
    FraudModule,
    CurrenciesModule,
  ],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}