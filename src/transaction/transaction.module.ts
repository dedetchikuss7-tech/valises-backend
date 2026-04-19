import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AbandonmentModule } from '../abandonment/abandonment.module';
import { PayoutModule } from '../payout/payout.module';
import { EnforcementModule } from '../enforcement/enforcement.module';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';

@Module({
  imports: [
    PrismaModule,
    LedgerModule,
    AbandonmentModule,
    PayoutModule,
    EnforcementModule,
  ],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
