import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';

import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { TransactionModule } from './transaction/transaction.module';
import { DisputeModule } from './dispute/dispute.module';
import { LedgerModule } from './ledger/ledger.module';
import { KycModule } from './kyc/kyc.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().port().optional(),

        // Swagger
        SWAGGER_ENABLED: Joi.string().valid('true', 'false').optional(),

        // CORS
        CORS_ORIGINS: Joi.string().allow('').optional(),

        // Rate limit
        THROTTLE_TTL: Joi.number().integer().min(1).optional(),
        THROTTLE_LIMIT: Joi.number().integer().min(1).optional(),
      }).unknown(true),
    }),

    // -------------------------
    // Global rate limiting (V1)
    // -------------------------
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL ?? 60), // seconds
        limit: Number(process.env.THROTTLE_LIMIT ?? 60), // requests per ttl
      },
    ]),

    PrismaModule,
    UserModule,
    TransactionModule,
    DisputeModule,
    LedgerModule,
    KycModule,
    HealthModule,
  ],
  providers: [
    // Applies throttling to ALL routes by default
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}