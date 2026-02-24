import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

// ⚠️ Garde tes modules existants (ajuste ces imports selon ton projet)
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { TransactionModule } from './transaction/transaction.module';
import { DisputeModule } from './dispute/dispute.module';
import { LedgerModule } from './ledger/ledger.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // Rate limiting global (par défaut)
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // fenêtre 60s
        limit: 60, // 60 requêtes / minute / IP (ajuste si besoin)
      },
    ]),

    // Tes modules applicatifs
    PrismaModule,
    AuthModule,
    UserModule,
    TransactionModule,
    DisputeModule,
    LedgerModule,
  ],
  providers: [
    // Rate limiting appliqué globalement
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}