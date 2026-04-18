import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
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
import { MessageModule } from './message/message.module';
import { AbandonmentModule } from './abandonment/abandonment.module';
import { AdminMessageModerationEventModule } from './admin-message-moderation-event/admin-message-moderation-event.module';
import { AdminAbandonmentModule } from './admin-abandonment/admin-abandonment.module';
import { PayoutModule } from './payout/payout.module';
import { RefundModule } from './refund/refund.module';
import { AdminLedgerIntegrityModule } from './admin-ledger-integrity/admin-ledger-integrity.module';
import { AdminActionAuditModule } from './admin-action-audit/admin-action-audit.module';
import { PricingModule } from './pricing/pricing.module';
import { AdminDashboardSummaryModule } from './admin-dashboard-summary/admin-dashboard-summary.module';
import { ProviderWebhookModule } from './provider-webhook/provider-webhook.module';
import { ReadinessModule } from './readiness/readiness.module';
import { AmlModule } from './aml/aml.module';

import { JwtAuthGuard } from './auth/jwt.guard';
import { RolesGuard } from './auth/roles.guard';
import { RequestContextLoggingInterceptor } from './common/interceptors/request-context-logging.interceptor';
import { HttpExceptionLoggingFilter } from './common/filters/http-exception-logging.filter';

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
        NODE_ENV: Joi.string().optional(),
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
    MessageModule,
    AbandonmentModule,
    AdminMessageModerationEventModule,
    AdminAbandonmentModule,
    PayoutModule,
    RefundModule,
    AdminLedgerIntegrityModule,
    AdminActionAuditModule,
    PricingModule,
    AdminDashboardSummaryModule,
    ProviderWebhookModule,
    ReadinessModule,
    AmlModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestContextLoggingInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionLoggingFilter },
  ],
})
export class AppModule {}