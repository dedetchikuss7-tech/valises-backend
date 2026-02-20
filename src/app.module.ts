import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { TransactionModule } from './transaction/transaction.module';
import { DisputeModule } from './dispute/dispute.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UserModule,
    TransactionModule,
    DisputeModule,
  ],
})
export class AppModule {}
