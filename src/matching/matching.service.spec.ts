import {
  BehaviorRestrictionKind,
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
  FlightTicketStatus,
  KycStatus,
  Role,
  TrustProfileStatus,
  TripStatus,
} from '@prisma/client';
import { MatchingService } from './matching.service';
import {
  MatchSortOrder,
  MatchTripCandidatesSortBy,
} from './dto/list-package-trip-candidates-query.dto';

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
      findUnique: jest.fn(),
    },
    behaviorRestriction: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MatchingService(prismaMock as any);
  });

  it('returns ranked candidates for a sender-owned package', async () => {
    prismaMock.package.findFirst.mockResolvedValue({
      id: 'pkg1',
      senderId: 'sender1',
      corridorId: 'corridor1',
      weightKg: 10,
    });

    prismaMock.trip.findMany.mockResolvedValue([
      {
        id: 'trip1',
        status: TripStatus.ACTIVE,
        flightTicketStatus: FlightTicketStatus.VERIFIED,
        departAt: new Date('2099-04-20T10:00:00.000Z'),
        capacityKg: 20,
        corridorId: 'corridor1',
        carrier: {
          id: 'traveler1',
          email: 'traveler1@test.com',
          kycStatus: KycStatus.VERIFIED,
        },
      },
    ]);

    prismaMock.userTrustProfile.findUnique.mockResolvedValue({
      score: 90,
      status: TrustProfileStatus.NORMAL,
      totalEvents: 10,
      positiveEvents: 8,
      negativeEvents: 2,
      activeRestrictionCount: 0,
    });

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.listTripCandidatesForPackage(
      'pkg1',
      'sender1',
      Role.USER,
      { limit: 20 },
    );

    expect(result).toHaveLength(1);
    expect(result[0].packageId).toBe('pkg1');
    expect(result[0].travelerId).toBe('traveler1');
    expect(result[0].eligible).toBe(true);
    expect(result[0].canProceedToTransaction).toBe(true);
    expect(result[0].rankingReasons).toContain('Same corridor as package');
    expect(result[0].rankingBreakdown.total).toBe(result[0].rankingScore);
  });

  it('filters out low-trust travelers when minTravelerTrustScore is set', async () => {
    prismaMock.package.findFirst.mockResolvedValue({
      id: 'pkg1',
      senderId: 'sender1',
      corridorId: 'corridor1',
      weightKg: 10,
    });

    prismaMock.trip.findMany.mockResolvedValue([
      {
        id: 'trip1',
        status: TripStatus.ACTIVE,
        flightTicketStatus: FlightTicketStatus.VERIFIED,
        departAt: new Date('2099-04-20T10:00:00.000Z'),
        capacityKg: 20,
        corridorId: 'corridor1',
        carrier: {
          id: 'traveler1',
          email: 'traveler1@test.com',
          kycStatus: KycStatus.VERIFIED,
        },
      },
    ]);

    prismaMock.userTrustProfile.findUnique.mockResolvedValue({
      score: 55,
      status: TrustProfileStatus.UNDER_REVIEW,
      totalEvents: 6,
      positiveEvents: 3,
      negativeEvents: 3,
      activeRestrictionCount: 0,
    });

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.listTripCandidatesForPackage(
      'pkg1',
      'sender1',
      Role.USER,
      {
        limit: 20,
        minTravelerTrustScore: 70,
      },
    );

    expect(result).toEqual([]);
  });

  it('filters out restricted travelers when excludeRestricted is true', async () => {
    prismaMock.package.findFirst.mockResolvedValue({
      id: 'pkg1',
      senderId: 'sender1',
      corridorId: 'corridor1',
      weightKg: 10,
    });

    prismaMock.trip.findMany.mockResolvedValue([
      {
        id: 'trip1',
        status: TripStatus.ACTIVE,
        flightTicketStatus: FlightTicketStatus.VERIFIED,
        departAt: new Date('2099-04-20T10:00:00.000Z'),
        capacityKg: 20,
        corridorId: 'corridor1',
        carrier: {
          id: 'traveler1',
          email: 'traveler1@test.com',
          kycStatus: KycStatus.VERIFIED,
        },
      },
    ]);

    prismaMock.userTrustProfile.findUnique.mockResolvedValue({
      score: 80,
      status: TrustProfileStatus.RESTRICTED,
      totalEvents: 8,
      positiveEvents: 5,
      negativeEvents: 3,
      activeRestrictionCount: 1,
    });

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([
      {
        id: 'r1',
        kind: BehaviorRestrictionKind.LIMIT_TRANSACTIONS,
        scope: BehaviorRestrictionScope.TRANSACTIONS,
        reasonCode: 'AML_BLOCK:tx1',
        status: BehaviorRestrictionStatus.ACTIVE,
      },
    ]);

    const result = await service.listTripCandidatesForPackage(
      'pkg1',
      'sender1',
      Role.USER,
      {
        limit: 20,
        excludeRestricted: true,
      },
    );

    expect(result).toEqual([]);
  });

  it('sorts by traveler trust score ascending when requested', async () => {
    prismaMock.package.findFirst.mockResolvedValue({
      id: 'pkg1',
      senderId: 'sender1',
      corridorId: 'corridor1',
      weightKg: 10,
    });

    prismaMock.trip.findMany.mockResolvedValue([
      {
        id: 'trip1',
        status: TripStatus.ACTIVE,
        flightTicketStatus: FlightTicketStatus.VERIFIED,
        departAt: new Date('2099-04-20T10:00:00.000Z'),
        capacityKg: 20,
        corridorId: 'corridor1',
        carrier: {
          id: 'traveler1',
          email: 'traveler1@test.com',
          kycStatus: KycStatus.VERIFIED,
        },
      },
      {
        id: 'trip2',
        status: TripStatus.ACTIVE,
        flightTicketStatus: FlightTicketStatus.VERIFIED,
        departAt: new Date('2099-04-22T10:00:00.000Z'),
        capacityKg: 20,
        corridorId: 'corridor1',
        carrier: {
          id: 'traveler2',
          email: 'traveler2@test.com',
          kycStatus: KycStatus.VERIFIED,
        },
      },
    ]);

    prismaMock.userTrustProfile.findUnique
      .mockResolvedValueOnce({
        score: 90,
        status: TrustProfileStatus.NORMAL,
        totalEvents: 10,
        positiveEvents: 8,
        negativeEvents: 2,
        activeRestrictionCount: 0,
      })
      .mockResolvedValueOnce({
        score: 70,
        status: TrustProfileStatus.NORMAL,
        totalEvents: 8,
        positiveEvents: 5,
        negativeEvents: 3,
        activeRestrictionCount: 0,
      });

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.listTripCandidatesForPackage(
      'pkg1',
      'sender1',
      Role.USER,
      {
        limit: 20,
        sortBy: MatchTripCandidatesSortBy.TRAVELER_TRUST_SCORE,
        sortOrder: MatchSortOrder.ASC,
      },
    );

    expect(result).toHaveLength(2);
    expect(result[0].travelerId).toBe('traveler2');
    expect(result[1].travelerId).toBe('traveler1');
  });

  it('allows ADMIN to read package candidates without sender ownership', async () => {
    prismaMock.package.findFirst.mockResolvedValue({
      id: 'pkg1',
      senderId: 'sender1',
      corridorId: 'corridor1',
      weightKg: 10,
    });

    prismaMock.trip.findMany.mockResolvedValue([]);

    const result = await service.listTripCandidatesForPackage(
      'pkg1',
      'admin1',
      Role.ADMIN,
      { limit: 20 },
    );

    expect(result).toEqual([]);
  });
});