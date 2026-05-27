import { MatchingService } from './matching.service';

const prismaMock = {
  package: { findFirst: jest.fn() },
  trip: { findMany: jest.fn(), findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
  userTrustProfile: { findUnique: jest.fn() },
  behaviorRestriction: { findMany: jest.fn() },
  packageTripShortlist: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
};

describe('computeDateProximityScore', () => {
  let service: MatchingService;

  beforeEach(() => {
    service = new MatchingService(prismaMock as any);
  });

  it('returns 10 for same day', () => {
    const d = new Date('2026-06-10T00:00:00.000Z');
    expect((service as any).computeDateProximityScore(d, d)).toBe(10);
  });

  it('returns 8 for 2 days apart', () => {
    const d1 = new Date('2026-06-10T00:00:00.000Z');
    const d2 = new Date('2026-06-12T00:00:00.000Z');
    expect((service as any).computeDateProximityScore(d1, d2)).toBe(8);
  });

  it('returns 5 for 5 days apart', () => {
    const d1 = new Date('2026-06-10T00:00:00.000Z');
    const d2 = new Date('2026-06-15T00:00:00.000Z');
    expect((service as any).computeDateProximityScore(d1, d2)).toBe(5);
  });

  it('returns 2 for 10 days apart', () => {
    const d1 = new Date('2026-06-10T00:00:00.000Z');
    const d2 = new Date('2026-06-20T00:00:00.000Z');
    expect((service as any).computeDateProximityScore(d1, d2)).toBe(2);
  });

  it('returns 0 for dates more than 14 days apart', () => {
    const d1 = new Date('2026-06-01T00:00:00.000Z');
    const d2 = new Date('2026-07-01T00:00:00.000Z');
    expect((service as any).computeDateProximityScore(d1, d2)).toBe(0);
  });

  it('returns 5 neutral when tripDepartureDate is null', () => {
    expect((service as any).computeDateProximityScore(null, new Date())).toBe(5);
  });

  it('returns 5 neutral when requestedDate is null', () => {
    expect((service as any).computeDateProximityScore(new Date(), null)).toBe(5);
  });

  it('returns 5 neutral when both dates are null', () => {
    expect((service as any).computeDateProximityScore(null, null)).toBe(5);
  });
});
