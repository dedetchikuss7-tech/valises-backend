import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { TransactionModule } from './transaction/transaction.module';
import { DisputeModule } from './dispute/dispute.module';
import { LedgerModule } from './ledger/ledger.module';
import { KycModule } from './kyc/kyc.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    PrismaModule,
    UserModule,
    TransactionModule,
    DisputeModule,
    LedgerModule,
    KycModule,
  ],
})
export class AppModule {}