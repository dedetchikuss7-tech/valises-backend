import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { TransactionModule } from './transaction/transaction.module';
import { DisputeModule } from './dispute/dispute.module';
import { LedgerModule } from './ledger/ledger.module';
import { KycModule } from './kyc/kyc.module';
import { HealthModule } from './health/health.module';
import { TripModule } from './trip/trip.module';
import { PackageModule } from './package/package.module';

import { JwtAuthGuard } from './auth/jwt.guard';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().port().optional(),
        SWAGGER_ENABLED: Joi.string().valid('true', 'false').optional(),
        CORS_ORIGINS: Joi.string().allow('').optional(),
        THROTTLE_TTL: Joi.number().integer().min(1).optional(),
        THROTTLE_LIMIT: Joi.number().integer().min(1).optional(),
        JWT_SECRET: Joi.string().min(3).default('dev_jwt_secret').optional(),
      }).unknown(true),
    }),

    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL ?? 60),
        limit: Number(process.env.THROTTLE_LIMIT ?? 60),
      },
    ]),

    PrismaModule,
    AuthModule,
    UserModule,
    TransactionModule,
    DisputeModule,
    LedgerModule,
    KycModule,
    HealthModule,
    TripModule,
    PackageModule,
  ],
  providers: [
    // 1) rate limit global
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // 2) JWT global (doit tourner AVANT RolesGuard)
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // 3) Roles global
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}