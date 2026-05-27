import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRateLimiterService, RateLimitedAction } from './user-rate-limiter.service';
import { RateLimitFraudLoggerService } from './rate-limit-fraud-logger.service';

export const RATE_LIMITED_ACTION_KEY = 'rateLimitedAction';
export const RateLimit = (action: RateLimitedAction) =>
  SetMetadata(RATE_LIMITED_ACTION_KEY, action);

@Injectable()
export class UserRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimiter: UserRateLimiterService,
    private readonly fraudLogger: RateLimitFraudLoggerService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const action = this.reflector.get<RateLimitedAction>(
      RATE_LIMITED_ACTION_KEY,
      context.getHandler(),
    );

    if (!action) return true;

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId;

    if (!userId) return true;

    const result = this.rateLimiter.check(userId, action);

    if (!result.allowed) {
      const retryAfterSeconds = Math.ceil((result.retryAfterMs ?? 0) / 1000);
      const response = context.switchToHttp().getResponse();
      response.setHeader('Retry-After', String(retryAfterSeconds));

      this.fraudLogger.logViolation(userId, action).catch(() => {});

      throw new HttpException(
        {
          statusCode: 429,
          error: 'Too Many Requests',
          message: `Rate limit exceeded for action ${action}. Retry after ${retryAfterSeconds}s.`,
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
