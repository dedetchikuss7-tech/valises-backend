import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { UserRateLimiterService } from './user-rate-limiter.service';
import { UserRateLimitGuard } from './user-rate-limit.guard';
import { RateLimitFraudLoggerService } from './rate-limit-fraud-logger.service';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [UserRateLimiterService, UserRateLimitGuard, RateLimitFraudLoggerService],
  exports: [UserRateLimiterService, UserRateLimitGuard, RateLimitFraudLoggerService],
})
export class RateLimiterModule {}
