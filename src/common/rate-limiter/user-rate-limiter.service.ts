import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum RateLimitedAction {
  CREATE_TRANSACTION = 'CREATE_TRANSACTION',
  CREATE_TRIP = 'CREATE_TRIP',
  CREATE_COMPENSATION = 'CREATE_COMPENSATION',
  CREATE_REVIEW = 'CREATE_REVIEW',
}

interface WindowConfig {
  maxRequests: number;
  windowMs: number;
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

@Injectable()
export class UserRateLimiterService {
  private readonly logger = new Logger(UserRateLimiterService.name);
  private readonly store = new Map<string, WindowEntry>();
  private readonly config: Map<RateLimitedAction, WindowConfig>;

  constructor(private readonly configService: ConfigService) {
    this.config = new Map([
      [
        RateLimitedAction.CREATE_TRANSACTION,
        {
          maxRequests: this.configService.get<number>('RATE_LIMIT_TRANSACTIONS_PER_HOUR') ?? 10,
          windowMs: 60 * 60 * 1000,
        },
      ],
      [
        RateLimitedAction.CREATE_TRIP,
        {
          maxRequests: this.configService.get<number>('RATE_LIMIT_TRIPS_PER_HOUR') ?? 5,
          windowMs: 60 * 60 * 1000,
        },
      ],
      [
        RateLimitedAction.CREATE_COMPENSATION,
        {
          maxRequests: this.configService.get<number>('RATE_LIMIT_COMPENSATION_PER_DAY') ?? 3,
          windowMs: 24 * 60 * 60 * 1000,
        },
      ],
      [
        RateLimitedAction.CREATE_REVIEW,
        {
          maxRequests: this.configService.get<number>('RATE_LIMIT_REVIEWS_PER_HOUR') ?? 10,
          windowMs: 60 * 60 * 1000,
        },
      ],
    ]);
  }

  check(
    userId: string,
    action: RateLimitedAction,
  ): { allowed: boolean; retryAfterMs?: number } {
    const windowConfig = this.config.get(action)!;
    const key = `${userId}:${action}`;
    const now = Date.now();

    const entry = this.store.get(key);

    if (!entry || now - entry.windowStart > windowConfig.windowMs) {
      this.store.set(key, { count: 1, windowStart: now });
      return { allowed: true };
    }

    if (entry.count >= windowConfig.maxRequests) {
      const retryAfterMs = windowConfig.windowMs - (now - entry.windowStart);
      this.logger.warn(
        `Rate limit hit: userId=${userId} action=${action} count=${entry.count}/${windowConfig.maxRequests}`,
      );
      return { allowed: false, retryAfterMs };
    }

    entry.count += 1;
    return { allowed: true };
  }

  reset(userId: string, action: RateLimitedAction): void {
    this.store.delete(`${userId}:${action}`);
  }
}
