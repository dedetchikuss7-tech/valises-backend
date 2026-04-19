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
import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
      findUnique: jest.fn(),
    },
    userTrustProfile: {
      findUnique: jest.fn(),
    },
    behaviorRestriction: {
      findMany: jest.fn(),
    },
    packageTripShortlist: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
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

    prismaMock.packageTripShortlist.findMany.mockResolvedValue([]);

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
    expect(result[0].isShortlisted).toBe(false);
    expect(result[0].senderPriorityRank).toBeNull();
    expect(result[0].senderPriorityLabel).toBeNull();
  });

  it('filters out low-trust travelers when minTravelerTrustScore is set', async () => {
    prismaMock.package.findFirst.mockResolvedValue({
      id: 'pkg1',
      senderId: 'sender1',
      corridorId: 'corridor1',
      weightKg: 10,
    });

    prismaMock.packageTripShortlist.findMany.mockResolvedValue([]);

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

    prismaMock.packageTripShortlist.findMany.mockResolvedValue([]);

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

    prismaMock.packageTripShortlist.findMany.mockResolvedValue([]);

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

    prismaMock.packageTripShortlist.findMany.mockResolvedValue([]);
    prismaMock.trip.findMany.mockResolvedValue([]);

    const result = await service.listTripCandidatesForPackage(
      'pkg1',
      'admin1',
      Role.ADMIN,
      { limit: 20 },
    );

    expect(result).toEqual([]);
  });

  it('includes shortlist visibility and sender priority signals in trip candidates', async () => {
    prismaMock.package.findFirst.mockResolvedValue({
      id: 'pkg1',
      senderId: 'sender1',
      corridorId: 'corridor1',
      weightKg: 10,
    });

    prismaMock.packageTripShortlist.findMany.mockResolvedValue([
      {
        id: 'short1',
        packageId: 'pkg1',
        tripId: 'trip1',
        senderId: 'sender1',
        travelerId: 'traveler1',
        priorityRank: 2,
        note: 'Top option',
        isVisible: true,
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        updatedAt: new Date('2099-01-02T00:00:00.000Z'),
      },
    ]);

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
      score: 88,
      status: TrustProfileStatus.NORMAL,
      totalEvents: 9,
      positiveEvents: 7,
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
    expect(result[0].isShortlisted).toBe(true);
    expect(result[0].senderPriorityRank).toBe(2);
    expect(result[0].senderPriorityLabel).toBe('TOP_PRIORITY');
    expect(result[0].rankingBreakdown.shortlistBoost).toBe(20);
    expect(result[0].rankingReasons).toContain('Shortlisted by sender');
  });

  it('filters by shortlistedOnly', async () => {
    prismaMock.package.findFirst.mockResolvedValue({
      id: 'pkg1',
      senderId: 'sender1',
      corridorId: 'corridor1',
      weightKg: 10,
    });

    prismaMock.packageTripShortlist.findMany.mockResolvedValue([
      {
        id: 'short1',
        packageId: 'pkg1',
        tripId: 'trip1',
        senderId: 'sender1',
        travelerId: 'traveler1',
        priorityRank: 5,
        note: null,
        isVisible: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

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
        departAt: new Date('2099-04-21T10:00:00.000Z'),
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
        score: 80,
        status: TrustProfileStatus.NORMAL,
        totalEvents: 7,
        positiveEvents: 5,
        negativeEvents: 2,
        activeRestrictionCount: 0,
      })
      .mockResolvedValueOnce({
        score: 82,
        status: TrustProfileStatus.NORMAL,
        totalEvents: 8,
        positiveEvents: 6,
        negativeEvents: 2,
        activeRestrictionCount: 0,
      });

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.listTripCandidatesForPackage(
      'pkg1',
      'sender1',
      Role.USER,
      {
        limit: 20,
        shortlistedOnly: true,
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0].trip.id).toBe('trip1');
    expect(result[0].isShortlisted).toBe(true);
  });

  it('sorts by shortlist priority ascending when requested', async () => {
    prismaMock.package.findFirst.mockResolvedValue({
      id: 'pkg1',
      senderId: 'sender1',
      corridorId: 'corridor1',
      weightKg: 10,
    });

    prismaMock.packageTripShortlist.findMany.mockResolvedValue([
      {
        id: 'short1',
        packageId: 'pkg1',
        tripId: 'trip1',
        senderId: 'sender1',
        travelerId: 'traveler1',
        priorityRank: 10,
        note: null,
        isVisible: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'short2',
        packageId: 'pkg1',
        tripId: 'trip2',
        senderId: 'sender1',
        travelerId: 'traveler2',
        priorityRank: 2,
        note: null,
        isVisible: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

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
        departAt: new Date('2099-04-21T10:00:00.000Z'),
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
        score: 80,
        status: TrustProfileStatus.NORMAL,
        totalEvents: 7,
        positiveEvents: 5,
        negativeEvents: 2,
        activeRestrictionCount: 0,
      })
      .mockResolvedValueOnce({
        score: 78,
        status: TrustProfileStatus.NORMAL,
        totalEvents: 7,
        positiveEvents: 5,
        negativeEvents: 2,
        activeRestrictionCount: 0,
      });

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);

    const result = await service.listTripCandidatesForPackage(
      'pkg1',
      'sender1',
      Role.USER,
      {
        limit: 20,
        sortBy: MatchTripCandidatesSortBy.SHORTLIST_PRIORITY,
        sortOrder: MatchSortOrder.ASC,
      },
    );

    expect(result).toHaveLength(2);
    expect(result[0].trip.id).toBe('trip2');
    expect(result[0].senderPriorityRank).toBe(2);
    expect(result[1].trip.id).toBe('trip1');
    expect(result[1].senderPriorityRank).toBe(10);
  });

  it('creates or updates a shortlist entry for a package/trip pair', async () => {
    prismaMock.package.findFirst.mockResolvedValue({
      id: 'pkg1',
      senderId: 'sender1',
      corridorId: 'corridor1',
      weightKg: 10,
    });

    prismaMock.trip.findUnique.mockResolvedValue({
      id: 'trip1',
      corridorId: 'corridor1',
      status: TripStatus.ACTIVE,
      flightTicketStatus: FlightTicketStatus.VERIFIED,
      departAt: new Date('2099-04-20T10:00:00.000Z'),
      capacityKg: 20,
      carrier: {
        id: 'traveler1',
        email: 'traveler1@test.com',
        kycStatus: KycStatus.VERIFIED,
      },
    });

    prismaMock.packageTripShortlist.upsert.mockResolvedValue({
      id: 'short1',
      packageId: 'pkg1',
      tripId: 'trip1',
      senderId: 'sender1',
      travelerId: 'traveler1',
      priorityRank: 5,
      note: 'Strong option',
      isVisible: true,
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
      updatedAt: new Date('2099-01-02T00:00:00.000Z'),
      trip: {
        id: 'trip1',
        status: TripStatus.ACTIVE,
        flightTicketStatus: FlightTicketStatus.VERIFIED,
        departAt: new Date('2099-04-20T10:00:00.000Z'),
        capacityKg: 20,
        corridorId: 'corridor1',
      },
      traveler: {
        id: 'traveler1',
        email: 'traveler1@test.com',
        kycStatus: KycStatus.VERIFIED,
      },
    });

    const result = await service.shortlistTripForPackage(
      'pkg1',
      'trip1',
      'sender1',
      Role.USER,
      {
        priorityRank: 5,
        note: 'Strong option',
        isVisible: true,
      },
    );

    expect(prismaMock.packageTripShortlist.upsert).toHaveBeenCalled();
    expect(result).toEqual({
      id: 'short1',
      packageId: 'pkg1',
      tripId: 'trip1',
      senderId: 'sender1',
      travelerId: 'traveler1',
      priorityRank: 5,
      note: 'Strong option',
      isVisible: true,
      traveler: {
        id: 'traveler1',
        email: 'traveler1@test.com',
        kycStatus: KycStatus.VERIFIED,
      },
      trip: {
        id: 'trip1',
        status: TripStatus.ACTIVE,
        flightTicketStatus: FlightTicketStatus.VERIFIED,
        departAt: new Date('2099-04-20T10:00:00.000Z'),
        capacityKg: 20,
        corridorId: 'corridor1',
      },
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
      updatedAt: new Date('2099-01-02T00:00:00.000Z'),
    });
  });

  it('removes a shortlist entry', async () => {
    prismaMock.package.findFirst.mockResolvedValue({
      id: 'pkg1',
      senderId: 'sender1',
      corridorId: 'corridor1',
      weightKg: 10,
    });

    prismaMock.packageTripShortlist.deleteMany.mockResolvedValue({
      count: 1,
    });

    const result = await service.removeShortlistedTripForPackage(
      'pkg1',
      'trip1',
      'sender1',
      Role.USER,
    );

    expect(prismaMock.packageTripShortlist.deleteMany).toHaveBeenCalledWith({
      where: {
        packageId: 'pkg1',
        tripId: 'trip1',
      },
    });

    expect(result).toEqual({
      packageId: 'pkg1',
      tripId: 'trip1',
      removed: true,
    });
  });

  it('lists shortlist entries ordered by priority rank then createdAt', async () => {
    prismaMock.package.findFirst.mockResolvedValue({
      id: 'pkg1',
      senderId: 'sender1',
      corridorId: 'corridor1',
      weightKg: 10,
    });

    prismaMock.packageTripShortlist.findMany.mockResolvedValue([
      {
        id: 'short1',
        packageId: 'pkg1',
        tripId: 'trip1',
        senderId: 'sender1',
        travelerId: 'traveler1',
        priorityRank: 2,
        note: 'Top option',
        isVisible: true,
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        updatedAt: new Date('2099-01-02T00:00:00.000Z'),
        trip: {
          id: 'trip1',
          status: TripStatus.ACTIVE,
          flightTicketStatus: FlightTicketStatus.VERIFIED,
          departAt: new Date('2099-04-20T10:00:00.000Z'),
          capacityKg: 20,
          corridorId: 'corridor1',
        },
        traveler: {
          id: 'traveler1',
          email: 'traveler1@test.com',
          kycStatus: KycStatus.VERIFIED,
        },
      },
    ]);

    const result = await service.listShortlistForPackage(
      'pkg1',
      'sender1',
      Role.USER,
    );

    expect(prismaMock.packageTripShortlist.findMany).toHaveBeenCalledWith({
      where: { packageId: 'pkg1' },
      orderBy: [{ priorityRank: 'asc' }, { createdAt: 'asc' }],
      include: {
        trip: true,
        traveler: true,
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0].priorityRank).toBe(2);
    expect(result[0].traveler.id).toBe('traveler1');
  });

  it('throws when shortlistable trip corridor does not match package corridor', async () => {
    prismaMock.package.findFirst.mockResolvedValue({
      id: 'pkg1',
      senderId: 'sender1',
      corridorId: 'corridor1',
      weightKg: 10,
    });

    prismaMock.trip.findUnique.mockResolvedValue({
      id: 'trip1',
      corridorId: 'corridor2',
      status: TripStatus.ACTIVE,
      flightTicketStatus: FlightTicketStatus.VERIFIED,
      carrier: {
        id: 'traveler1',
        email: 'traveler1@test.com',
        kycStatus: KycStatus.VERIFIED,
      },
    });

    await expect(
      service.shortlistTripForPackage(
        'pkg1',
        'trip1',
        'sender1',
        Role.USER,
        { priorityRank: 5 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when trip is not found for shortlist', async () => {
    prismaMock.package.findFirst.mockResolvedValue({
      id: 'pkg1',
      senderId: 'sender1',
      corridorId: 'corridor1',
      weightKg: 10,
    });

    prismaMock.trip.findUnique.mockResolvedValue(null);

    await expect(
      service.shortlistTripForPackage(
        'pkg1',
        'trip1',
        'sender1',
        Role.USER,
        { priorityRank: 5 },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});