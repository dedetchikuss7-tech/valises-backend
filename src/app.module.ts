// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { envValidationSchema } from './config/env.validation';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { TransactionModule } from './transaction/transaction.module';
import { DisputeModule } from './dispute/dispute.module';

import { ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),

    // Anti brute-force (par défaut global)
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => [
        {
          name: 'global',
          ttl: 60_000, // 60s
          limit: 120,  // 120 req/min global
        },
        {
          name: 'auth',
          ttl: 60_000,
          limit: 20, // 20 req/min pour endpoints auth si on le cible
        },
      ],
    }),

    PrismaModule,
    AuthModule,
    UserModule,
    TransactionModule,
    DisputeModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // guard global
    },
  ],
})
export class AppModule {}