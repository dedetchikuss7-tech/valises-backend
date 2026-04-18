import {
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
  FlightTicketStatus,
  KycStatus,
  Role,
  TrustProfileStatus,
  TripStatus,
} from '@prisma/client';
import { MatchingService } from './matching.service';

describe('MatchingService', () => {
  let service: MatchingService;

  const prismaMock = {
    package: {
      findFirst: jest.fn(),
    },
    trip: {
      findMany: jest.fn(),
    },
    userTrustProfile: {
      findMany: jest.fn(),
    },
    behaviorRestriction: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MatchingService(prismaMock as any);
  });

  it('returns ranked eligible trip candidates', async () => {
    prismaMock.package.findFirst.mockResolvedValue({
      id: 'pkg1',
      senderId: 'sender1',
      corridorId: 'corridor1',
      weightKg: 10,
      status: 'PUBLISHED',
    });

    prismaMock.trip.findMany.mockResolvedValue([
      {
        id: 'trip1',
        departAt: new Date('2026-04-21T08:00:00.000Z'),
        capacityKg: 20,
        status: TripStatus.ACTIVE,
        flightTicketStatus: FlightTicketStatus.VERIFIED,
        corridorId: 'corridor1',
        carrier: {
          id: 'traveler1',
          email: 'traveler1@test.com',
          kycStatus: KycStatus.VERIFIED,
        },
      },
    ]);

    prismaMock.userTrustProfile.findMany.mockResolvedValue([
      {
        userId: 'traveler1',
        score: 90,
        status: TrustProfileStatus.NORMAL,
        totalEvents: 10,
        positiveEvents: 7,
        negativeEvents: 3,
        activeRestrictionCount: 0,
      },
    ]);

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.listTripCandidatesForPackage(
      'pkg1',
      'sender1',
      Role.USER,
      20,
    );

    expect(result).toHaveLength(1);
    expect(result[0].eligible).toBe(true);
    expect(result[0].canProceedToTransaction).toBe(true);
    expect(result[0].rankingTier).toBeDefined();
    expect(result[0].rankingScore).toBeGreaterThan(0);
  });

  it('marks candidate not eligible when traveler KYC is not verified', async () => {
    prismaMock.package.findFirst.mockResolvedValue({
      id: 'pkg1',
      senderId: 'sender1',
      corridorId: 'corridor1',
      weightKg: 10,
      status: 'PUBLISHED',
    });

    prismaMock.trip.findMany.mockResolvedValue([
      {
        id: 'trip1',
        departAt: new Date('2026-04-21T08:00:00.000Z'),
        capacityKg: 20,
        status: TripStatus.ACTIVE,
        flightTicketStatus: FlightTicketStatus.VERIFIED,
        corridorId: 'corridor1',
        carrier: {
          id: 'traveler1',
          email: 'traveler1@test.com',
          kycStatus: KycStatus.PENDING,
        },
      },
    ]);

    prismaMock.userTrustProfile.findMany.mockResolvedValue([]);
    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.listTripCandidatesForPackage(
      'pkg1',
      'sender1',
      Role.USER,
      20,
    );

    expect(result[0].eligible).toBe(false);
    expect(result[0].rankingTier).toBe('NOT_ELIGIBLE');
    expect(result[0].rankingReasons).toContain('Traveler KYC not verified');
  });

  it('marks candidate not eligible when transaction restriction is active', async () => {
    prismaMock.package.findFirst.mockResolvedValue({
      id: 'pkg1',
      senderId: 'sender1',
      corridorId: 'corridor1',
      weightKg: 10,
      status: 'PUBLISHED',
    });

    prismaMock.trip.findMany.mockResolvedValue([
      {
        id: 'trip1',
        departAt: new Date('2026-04-21T08:00:00.000Z'),
        capacityKg: 20,
        status: TripStatus.ACTIVE,
        flightTicketStatus: FlightTicketStatus.VERIFIED,
        corridorId: 'corridor1',
        carrier: {
          id: 'traveler1',
          email: 'traveler1@test.com',
          kycStatus: KycStatus.VERIFIED,
        },
      },
    ]);

    prismaMock.userTrustProfile.findMany.mockResolvedValue([
      {
        userId: 'traveler1',
        score: 80,
        status: TrustProfileStatus.NORMAL,
        totalEvents: 2,
        positiveEvents: 1,
        negativeEvents: 1,
        activeRestrictionCount: 1,
      },
    ]);

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([
      {
        id: 'restriction1',
        userId: 'traveler1',
        kind: 'LIMIT_TRANSACTIONS',
        scope: BehaviorRestrictionScope.TRANSACTIONS,
        status: BehaviorRestrictionStatus.ACTIVE,
        reasonCode: 'RISK_REVIEW',
      },
    ]);

    const result = await service.listTripCandidatesForPackage(
      'pkg1',
      'sender1',
      Role.USER,
      20,
    );

    expect(result[0].eligible).toBe(false);
    expect(result[0].canProceedToTransaction).toBe(false);
    expect(result[0].rankingReasons).toContain('Transaction restriction active');
  });
});