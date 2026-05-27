import { Test, TestingModule } from '@nestjs/testing';
import { UserRateLimiterService, RateLimitedAction } from './user-rate-limiter.service';
import { ConfigService } from '@nestjs/config';

const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, number> = {
      RATE_LIMIT_TRANSACTIONS_PER_HOUR: 3,
      RATE_LIMIT_TRIPS_PER_HOUR: 2,
      RATE_LIMIT_COMPENSATION_PER_DAY: 1,
      RATE_LIMIT_REVIEWS_PER_HOUR: 5,
    };
    return map[key];
  }),
};

describe('UserRateLimiterService', () => {
  let service: UserRateLimiterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRateLimiterService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<UserRateLimiterService>(UserRateLimiterService);
  });

  it('allows requests within limit', () => {
    const result1 = service.check('u1', RateLimitedAction.CREATE_TRANSACTION);
    const result2 = service.check('u1', RateLimitedAction.CREATE_TRANSACTION);
    const result3 = service.check('u1', RateLimitedAction.CREATE_TRANSACTION);
    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
    expect(result3.allowed).toBe(true);
  });

  it('blocks request when limit exceeded', () => {
    service.check('u2', RateLimitedAction.CREATE_TRIP);
    service.check('u2', RateLimitedAction.CREATE_TRIP);
    const result = service.check('u2', RateLimitedAction.CREATE_TRIP);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets window after TTL', () => {
    service.check('u3', RateLimitedAction.CREATE_COMPENSATION);
    const blocked = service.check('u3', RateLimitedAction.CREATE_COMPENSATION);
    expect(blocked.allowed).toBe(false);

    service.reset('u3', RateLimitedAction.CREATE_COMPENSATION);
    const allowed = service.check('u3', RateLimitedAction.CREATE_COMPENSATION);
    expect(allowed.allowed).toBe(true);
  });

  it('isolates limits between users', () => {
    service.check('u4', RateLimitedAction.CREATE_TRIP);
    service.check('u4', RateLimitedAction.CREATE_TRIP);

    const u5result = service.check('u5', RateLimitedAction.CREATE_TRIP);
    expect(u5result.allowed).toBe(true);
  });

  it('isolates limits between actions for same user', () => {
    service.check('u6', RateLimitedAction.CREATE_TRIP);
    service.check('u6', RateLimitedAction.CREATE_TRIP);
    const txResult = service.check('u6', RateLimitedAction.CREATE_TRANSACTION);
    expect(txResult.allowed).toBe(true);
  });
});
