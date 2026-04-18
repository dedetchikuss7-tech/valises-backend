import {
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
  TrustProfileStatus,
} from '@prisma/client';
import { TrustService } from './trust.service';

describe('TrustService', () => {
  let service: TrustService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    userTrustProfile: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    reputationEvent: {
      create: jest.fn(),
    },
    behaviorRestriction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TrustService(prismaMock as any);
  });

  it('creates a positive reputation event and updates profile score', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user1' });

    prismaMock.userTrustProfile.upsert.mockResolvedValue({
      id: 'profile1',
      userId: 'user1',
      score: 90,
      status: TrustProfileStatus.NORMAL,
      totalEvents: 4,
      positiveEvents: 2,
      negativeEvents: 2,
      activeRestrictionCount: 0,
    });

    prismaMock.reputationEvent.create.mockResolvedValue({
      id: 'evt1',
      createdAt: new Date('2026-04-18T12:00:00.000Z'),
    });

    prismaMock.userTrustProfile.update.mockResolvedValue({
      id: 'profile1',
      userId: 'user1',
      score: 100,
      status: TrustProfileStatus.NORMAL,
      totalEvents: 5,
      positiveEvents: 3,
      negativeEvents: 2,
      activeRestrictionCount: 0,
      lastEventAt: new Date('2026-04-18T12:00:00.000Z'),
    });

    const result = await service.recordEvent('user1', {
      kind: 'POSITIVE_SUCCESSFUL_COMPLETION' as any,
      scoreDelta: 15,
      reasonCode: 'SUCCESSFUL_COMPLETION',
      reasonSummary: 'Transaction completed successfully.',
      transactionId: 'tx1',
    });

    expect(prismaMock.reputationEvent.create).toHaveBeenCalledWith({
      data: {
        userId: 'user1',
        transactionId: 'tx1',
        kind: 'POSITIVE_SUCCESSFUL_COMPLETION',
        scoreDelta: 15,
        reasonCode: 'SUCCESSFUL_COMPLETION',
        reasonSummary: 'Transaction completed successfully.',
        metadata: undefined,
      },
    });

    expect(prismaMock.userTrustProfile.update).toHaveBeenCalledWith({
      where: { userId: 'user1' },
      data: {
        score: 100,
        totalEvents: 5,
        positiveEvents: 3,
        negativeEvents: 2,
        lastEventAt: new Date('2026-04-18T12:00:00.000Z'),
        status: TrustProfileStatus.NORMAL,
      },
    });

    expect(result).toEqual({
      event: {
        id: 'evt1',
        createdAt: new Date('2026-04-18T12:00:00.000Z'),
      },
      profile: {
        id: 'profile1',
        userId: 'user1',
        score: 100,
        status: TrustProfileStatus.NORMAL,
        totalEvents: 5,
        positiveEvents: 3,
        negativeEvents: 2,
        activeRestrictionCount: 0,
        lastEventAt: new Date('2026-04-18T12:00:00.000Z'),
      },
    });
  });

  it('creates a negative reputation event and moves profile under review when score drops below threshold', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user1' });

    prismaMock.userTrustProfile.upsert.mockResolvedValue({
      id: 'profile1',
      userId: 'user1',
      score: 75,
      status: TrustProfileStatus.NORMAL,
      totalEvents: 2,
      positiveEvents: 1,
      negativeEvents: 1,
      activeRestrictionCount: 0,
    });

    prismaMock.reputationEvent.create.mockResolvedValue({
      id: 'evt2',
      createdAt: new Date('2026-04-18T12:30:00.000Z'),
    });

    prismaMock.userTrustProfile.update.mockResolvedValue({
      id: 'profile1',
      userId: 'user1',
      score: 60,
      status: TrustProfileStatus.UNDER_REVIEW,
      totalEvents: 3,
      positiveEvents: 1,
      negativeEvents: 2,
      activeRestrictionCount: 0,
      lastEventAt: new Date('2026-04-18T12:30:00.000Z'),
    });

    const result = await service.recordEvent('user1', {
      kind: 'NEGATIVE_DISPUTE_OPENED' as any,
      scoreDelta: -15,
      reasonCode: 'DISPUTE_OPENED',
      reasonSummary: 'A dispute was opened.',
    });

    expect(prismaMock.userTrustProfile.update).toHaveBeenCalledWith({
      where: { userId: 'user1' },
      data: {
        score: 60,
        totalEvents: 3,
        positiveEvents: 1,
        negativeEvents: 2,
        lastEventAt: new Date('2026-04-18T12:30:00.000Z'),
        status: TrustProfileStatus.UNDER_REVIEW,
      },
    });

    expect(result.profile.status).toBe(TrustProfileStatus.UNDER_REVIEW);
    expect(result.profile.score).toBe(60);
  });

  it('imposes a restriction and marks profile as restricted', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user1' });

    prismaMock.userTrustProfile.upsert.mockResolvedValue({
      id: 'profile1',
      userId: 'user1',
      score: 85,
      status: TrustProfileStatus.NORMAL,
      totalEvents: 4,
      positiveEvents: 2,
      negativeEvents: 2,
      activeRestrictionCount: 0,
    });

    prismaMock.behaviorRestriction.create.mockResolvedValue({
      id: 'restriction1',
      userId: 'user1',
      kind: 'BLOCK_MESSAGING',
      scope: BehaviorRestrictionScope.MESSAGING,
      status: BehaviorRestrictionStatus.ACTIVE,
      reasonCode: 'MESSAGE_ABUSE',
      reasonSummary: 'Too many blocked messages.',
      imposedById: 'admin1',
    });

    prismaMock.userTrustProfile.update.mockResolvedValue({
      id: 'profile1',
      userId: 'user1',
      score: 85,
      status: TrustProfileStatus.RESTRICTED,
      totalEvents: 4,
      positiveEvents: 2,
      negativeEvents: 2,
      activeRestrictionCount: 1,
    });

    const result = await service.imposeRestriction(
      'user1',
      {
        kind: 'BLOCK_MESSAGING' as any,
        scope: BehaviorRestrictionScope.MESSAGING,
        reasonCode: 'MESSAGE_ABUSE',
        reasonSummary: 'Too many blocked messages.',
      },
      'admin1',
    );

    expect(prismaMock.behaviorRestriction.create).toHaveBeenCalledWith({
      data: {
        userId: 'user1',
        kind: 'BLOCK_MESSAGING',
        scope: BehaviorRestrictionScope.MESSAGING,
        status: BehaviorRestrictionStatus.ACTIVE,
        reasonCode: 'MESSAGE_ABUSE',
        reasonSummary: 'Too many blocked messages.',
        metadata: undefined,
        imposedById: 'admin1',
        expiresAt: null,
      },
    });

    expect(prismaMock.userTrustProfile.update).toHaveBeenCalledWith({
      where: { userId: 'user1' },
      data: {
        activeRestrictionCount: 1,
        status: TrustProfileStatus.RESTRICTED,
      },
    });

    expect(result).toEqual({
      restriction: {
        id: 'restriction1',
        userId: 'user1',
        kind: 'BLOCK_MESSAGING',
        scope: BehaviorRestrictionScope.MESSAGING,
        status: BehaviorRestrictionStatus.ACTIVE,
        reasonCode: 'MESSAGE_ABUSE',
        reasonSummary: 'Too many blocked messages.',
        imposedById: 'admin1',
      },
      profile: {
        id: 'profile1',
        userId: 'user1',
        score: 85,
        status: TrustProfileStatus.RESTRICTED,
        totalEvents: 4,
        positiveEvents: 2,
        negativeEvents: 2,
        activeRestrictionCount: 1,
      },
    });
  });

  it('releases an active restriction and refreshes profile status', async () => {
    prismaMock.behaviorRestriction.findUnique.mockResolvedValue({
      id: 'restriction1',
      userId: 'user1',
      status: BehaviorRestrictionStatus.ACTIVE,
    });

    prismaMock.behaviorRestriction.update.mockResolvedValue({
      id: 'restriction1',
      userId: 'user1',
      status: BehaviorRestrictionStatus.RELEASED,
      releasedById: 'admin1',
    });

    prismaMock.userTrustProfile.upsert.mockResolvedValue({
      id: 'profile1',
      userId: 'user1',
      score: 80,
      status: TrustProfileStatus.RESTRICTED,
      totalEvents: 4,
      positiveEvents: 2,
      negativeEvents: 2,
      activeRestrictionCount: 1,
    });

    prismaMock.behaviorRestriction.count.mockResolvedValue(0);

    prismaMock.userTrustProfile.update.mockResolvedValue({
      id: 'profile1',
      userId: 'user1',
      score: 80,
      status: TrustProfileStatus.NORMAL,
      totalEvents: 4,
      positiveEvents: 2,
      negativeEvents: 2,
      activeRestrictionCount: 0,
    });

    const result = await service.releaseRestriction(
      'restriction1',
      { notes: 'Restriction released after review.' },
      'admin1',
    );

    expect(prismaMock.behaviorRestriction.update).toHaveBeenCalledWith({
      where: { id: 'restriction1' },
      data: {
        status: BehaviorRestrictionStatus.RELEASED,
        releasedById: 'admin1',
        releasedAt: expect.any(Date),
        metadata: {
          releaseNotes: 'Restriction released after review.',
        },
      },
    });

    expect(prismaMock.behaviorRestriction.count).toHaveBeenCalledWith({
      where: {
        userId: 'user1',
        status: BehaviorRestrictionStatus.ACTIVE,
      },
    });

    expect(prismaMock.userTrustProfile.update).toHaveBeenCalledWith({
      where: { userId: 'user1' },
      data: {
        activeRestrictionCount: 0,
        status: TrustProfileStatus.NORMAL,
      },
    });

    expect(result).toEqual({
      restriction: {
        id: 'restriction1',
        userId: 'user1',
        status: BehaviorRestrictionStatus.RELEASED,
        releasedById: 'admin1',
      },
      profile: {
        id: 'profile1',
        userId: 'user1',
        score: 80,
        status: TrustProfileStatus.NORMAL,
        totalEvents: 4,
        positiveEvents: 2,
        negativeEvents: 2,
        activeRestrictionCount: 0,
      },
    });
  });

  it('lists restrictions with filters', async () => {
    prismaMock.behaviorRestriction.findMany.mockResolvedValue([
      {
        id: 'restriction1',
        userId: 'user1',
        scope: BehaviorRestrictionScope.GLOBAL,
        status: BehaviorRestrictionStatus.ACTIVE,
      },
    ]);

    const result = await service.listRestrictions({
      userId: 'user1',
      status: BehaviorRestrictionStatus.ACTIVE,
      scope: BehaviorRestrictionScope.GLOBAL,
      limit: 20,
    });

    expect(prismaMock.behaviorRestriction.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user1',
        status: BehaviorRestrictionStatus.ACTIVE,
        scope: BehaviorRestrictionScope.GLOBAL,
      },
      orderBy: [{ imposedAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });

    expect(result).toEqual([
      {
        id: 'restriction1',
        userId: 'user1',
        scope: BehaviorRestrictionScope.GLOBAL,
        status: BehaviorRestrictionStatus.ACTIVE,
      },
    ]);
  });

  it('returns a profile by ensuring it exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user1' });

    prismaMock.userTrustProfile.upsert.mockResolvedValue({
      id: 'profile1',
      userId: 'user1',
      score: 100,
      status: TrustProfileStatus.NORMAL,
      totalEvents: 0,
      positiveEvents: 0,
      negativeEvents: 0,
      activeRestrictionCount: 0,
    });

    const result = await service.getProfile('user1');

    expect(prismaMock.userTrustProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 'user1' },
      update: {},
      create: {
        userId: 'user1',
        score: 100,
        status: TrustProfileStatus.NORMAL,
        totalEvents: 0,
        positiveEvents: 0,
        negativeEvents: 0,
        activeRestrictionCount: 0,
      },
    });

    expect(result).toEqual({
      id: 'profile1',
      userId: 'user1',
      score: 100,
      status: TrustProfileStatus.NORMAL,
      totalEvents: 0,
      positiveEvents: 0,
      negativeEvents: 0,
      activeRestrictionCount: 0,
    });
  });
});