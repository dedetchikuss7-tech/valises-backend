import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
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
import { TrustModule } from './trust/trust.module';
import { LegalModule } from './legal/legal.module';
import { MobileContractModule } from './mobile-contract/mobile-contract.module';
import { MatchingModule } from './matching/matching.module';
import { AdminOpsModule } from './admin-ops/admin-ops.module';
import { AdminCaseManagementModule } from './admin-case-management/admin-case-management.module';
import { AdminReconciliationModule } from './admin-reconciliation/admin-reconciliation.module';
import { AdminFinancialControlsModule } from './admin-financial-controls/admin-financial-controls.module';
import { AdminFinancialOperationsModule } from './admin-financial-operations/admin-financial-operations.module';
import { AdminTimelineModule } from './admin-timeline/admin-timeline.module';
import { AdminOwnershipModule } from './admin-ownership/admin-ownership.module';
import { AdminWorkloadModule } from './admin-workload/admin-workload.module';
import { AdminTransactionOperationsModule } from './admin-transaction-operations/admin-transaction-operations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ActivityFeedModule } from './activity-feed/activity-feed.module';
import { EvidenceModule } from './evidence/evidence.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PushModule } from './push/push.module';
import { ReviewModule } from './review/review.module';
import { FraudModule } from './fraud/fraud.module';
import { AdminSupportModule } from './admin-support/admin-support.module';
import { ReferralModule } from './referral/referral.module';
import { AdminFinanceModule } from './admin-finance/admin-finance.module';
import { QueueModule } from './queue/queue.module';
import { QueueWorkersModule } from './queue/queue-workers.module';
import { OperationalHealthModule } from './operational-health/operational-health.module';
import { DocumentLifecycleModule } from './document-lifecycle/document-lifecycle.module';
import { AdminRunbooksModule } from './admin-runbooks/admin-runbooks.module';
import { CompensationModule } from './compensation/compensation.module';
import { CorridorAdminModule } from './corridor-admin/corridor-admin.module';
import { CorridorsModule } from './corridors/corridors.module';
import { UserSuspensionModule } from './user-suspension/user-suspension.module';
import { FinancialAuditModule } from './financial-audit/financial-audit.module';
import { CancellationModule } from './cancellation/cancellation.module';
import { AdminUsersModule } from './admin/users/admin-users.module';
import { WebhookRetryModule } from './admin/webhook-retry/webhook-retry.module';
import { RateLimiterModule } from './common/rate-limiter/rate-limiter.module';

import { JwtAuthGuard } from './auth/jwt.guard';
import { RolesGuard } from './auth/roles.guard';
import { UserStatusGuard } from './auth/guards/user-status.guard';
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
        JWT_SECRET: Joi.string().min(32).required(),
        NODE_ENV: Joi.string().optional(),
        EMAIL_PROVIDER: Joi.string().valid('SENDGRID', 'MOCK').default('MOCK'),
        SENDGRID_API_KEY: Joi.string().optional(),
        EMAIL_FROM_ADDRESS: Joi.string().email().default('noreply@valises.app'),
        EMAIL_FROM_NAME: Joi.string().default('Valises'),
        EMAIL_UNSUBSCRIBE_SECRET: Joi.string().min(32).optional(),
        PUSH_PROVIDER: Joi.string().valid('FCM', 'MOCK').default('MOCK'),
        FCM_SERVER_KEY: Joi.string().when('PUSH_PROVIDER', {
          is: 'FCM',
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
        RATE_LIMIT_TRANSACTIONS_PER_HOUR: Joi.number().integer().min(1).default(10),
        RATE_LIMIT_TRIPS_PER_HOUR: Joi.number().integer().min(1).default(5),
        RATE_LIMIT_COMPENSATION_PER_DAY: Joi.number().integer().min(1).default(3),
        RATE_LIMIT_REVIEWS_PER_HOUR: Joi.number().integer().min(1).default(10),
      }).unknown(true),
    }),

    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL ?? 60),
        limit: Number(process.env.THROTTLE_LIMIT ?? 60),
      },
    ]),

    ScheduleModule.forRoot(),

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
    TrustModule,
    LegalModule,
    MobileContractModule,
    MatchingModule,
    AdminOpsModule,
    AdminCaseManagementModule,
    AdminReconciliationModule,
    AdminFinancialControlsModule,
    AdminFinancialOperationsModule,
    AdminTimelineModule,
    AdminOwnershipModule,
    AdminWorkloadModule,
    AdminTransactionOperationsModule,
    NotificationsModule,
    ActivityFeedModule,
    EvidenceModule,
    OnboardingModule,
    PushModule,
    ReviewModule,
    FraudModule,
    AdminSupportModule,
    ReferralModule,
    AdminFinanceModule,
    QueueModule,
    QueueWorkersModule,
    OperationalHealthModule,
    DocumentLifecycleModule,
    AdminRunbooksModule,
    CompensationModule,
    CorridorAdminModule,
    CorridorsModule,
    UserSuspensionModule,
    FinancialAuditModule,
    CancellationModule,
    AdminUsersModule,
    WebhookRetryModule,
    RateLimiterModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: UserStatusGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestContextLoggingInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionLoggingFilter },
  ],
})
export class AppModule {}