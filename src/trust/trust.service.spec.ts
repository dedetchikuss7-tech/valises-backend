import { NotFoundException } from '@nestjs/common';
import {
  BehaviorRestrictionKind,
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
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    reputationEvent: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    behaviorRestriction: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TrustService(prismaMock as any);

    prismaMock.user.findUnique.mockResolvedValue({ id: 'user1' });
    prismaMock.userTrustProfile.findUnique.mockResolvedValue({
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

  it('records a reputation event and updates the profile', async () => {
    prismaMock.reputationEvent.create.mockResolvedValue({
      id: 'evt1',
      createdAt: new Date('2026-04-19T10:00:00.000Z'),
    });

    prismaMock.userTrustProfile.update.mockResolvedValue({
      id: 'profile1',
      userId: 'user1',
      score: 85,
      totalEvents: 1,
      positiveEvents: 0,
      negativeEvents: 1,
      activeRestrictionCount: 0,
      status: TrustProfileStatus.NORMAL,
    });

    const result = await service.recordEvent('user1', {
      kind: 'NEGATIVE_DISPUTE_OPENED' as any,
      scoreDelta: -15,
      reasonCode: 'DISPUTE_OPENED',
      transactionId: 'tx1',
    });

    expect(prismaMock.reputationEvent.create).toHaveBeenCalled();
    expect(prismaMock.userTrustProfile.update).toHaveBeenCalled();
    expect(result.event.id).toBe('evt1');
  });

  it('recordEventIfMissing returns existing event when duplicate exists for same transaction scope', async () => {
    prismaMock.reputationEvent.findFirst.mockResolvedValue({
      id: 'evt-existing',
      transactionId: 'tx1',
      reasonCode: 'DISPUTE_OPENED',
      kind: 'NEGATIVE_DISPUTE_OPENED',
    });

    const result = await service.recordEventIfMissing(
      'user1',
      {
        kind: 'NEGATIVE_DISPUTE_OPENED' as any,
        scoreDelta: -15,
        reasonCode: 'DISPUTE_OPENED',
        transactionId: 'tx1',
      },
      { dedupeScope: 'TRANSACTION' },
    );

    expect(prismaMock.reputationEvent.create).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(result.event.id).toBe('evt-existing');
  });

  it('recordEventIfMissing creates a new event when no duplicate exists', async () => {
    prismaMock.reputationEvent.findFirst.mockResolvedValue(null);
    prismaMock.reputationEvent.create.mockResolvedValue({
      id: 'evt-new',
      createdAt: new Date('2026-04-19T10:00:00.000Z'),
    });

    prismaMock.userTrustProfile.update.mockResolvedValue({
      id: 'profile1',
      userId: 'user1',
      score: 90,
      totalEvents: 1,
      positiveEvents: 1,
      negativeEvents: 0,
      activeRestrictionCount: 0,
      status: TrustProfileStatus.NORMAL,
    });

    const result = await service.recordEventIfMissing(
      'user1',
      {
        kind: 'POSITIVE_DELIVERY_CONFIRMED' as any,
        scoreDelta: 10,
        reasonCode: 'DELIVERY_CONFIRMED',
        transactionId: 'tx1',
      },
      { dedupeScope: 'TRANSACTION' },
    );

    expect(prismaMock.reputationEvent.create).toHaveBeenCalled();
    expect(result.created).toBe(true);
    expect(result.event.id).toBe('evt-new');
  });

  it('imposes a restriction and updates the profile', async () => {
    prismaMock.behaviorRestriction.create.mockResolvedValue({
      id: 'r1',
      userId: 'user1',
      kind: BehaviorRestrictionKind.BLOCK_MESSAGING,
      scope: BehaviorRestrictionScope.MESSAGING,
      status: BehaviorRestrictionStatus.ACTIVE,
      reasonCode: 'MESSAGE_ABUSE',
      reasonSummary: null,
      imposedById: 'admin1',
      releasedById: null,
      imposedAt: new Date('2026-04-19T10:00:00.000Z'),
      releasedAt: null,
      expiresAt: null,
      metadata: null,
      createdAt: new Date('2026-04-19T10:00:00.000Z'),
      updatedAt: new Date('2026-04-19T10:00:00.000Z'),
    });

    prismaMock.userTrustProfile.update.mockResolvedValue({
      id: 'profile1',
      userId: 'user1',
      score: 100,
      totalEvents: 0,
      positiveEvents: 0,
      negativeEvents: 0,
      activeRestrictionCount: 1,
      status: TrustProfileStatus.RESTRICTED,
    });

    const result = await service.imposeRestriction(
      'user1',
      {
        kind: BehaviorRestrictionKind.BLOCK_MESSAGING,
        scope: BehaviorRestrictionScope.MESSAGING,
        reasonCode: 'MESSAGE_ABUSE',
      },
      'admin1',
    );

    expect(result.restriction.id).toBe('r1');
    expect(result.restriction.isActive).toBe(true);
    expect(result.profile.status).toBe(TrustProfileStatus.RESTRICTED);
  });

  it('lists restrictions in paginated operational format', async () => {
    prismaMock.behaviorRestriction.findMany.mockResolvedValue([
      {
        id: 'r1',
        userId: 'user1',
        kind: BehaviorRestrictionKind.WARNING_ONLY,
        scope: BehaviorRestrictionScope.TRANSACTIONS,
        status: BehaviorRestrictionStatus.ACTIVE,
        reasonCode: 'AML_REVIEW_REQUIRED:tx1',
        reasonSummary: 'AML review required',
        imposedById: null,
        releasedById: null,
        imposedAt: new Date('2026-04-19T10:00:00.000Z'),
        releasedAt: null,
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        metadata: { source: 'aml' },
        createdAt: new Date('2026-04-19T10:00:00.000Z'),
        updatedAt: new Date('2026-04-19T10:00:00.000Z'),
      },
    ]);

    const result = await service.listRestrictions({
      q: 'AML',
      limit: 20,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].reasonCode).toBe('AML_REVIEW_REQUIRED:tx1');
    expect(result.items[0].isActive).toBe(true);
  });

  it('expires due active restrictions and refreshes affected profiles', async () => {
    prismaMock.behaviorRestriction.findMany.mockResolvedValue([
      {
        id: 'r-expired',
        userId: 'user1',
        kind: BehaviorRestrictionKind.WARNING_ONLY,
        scope: BehaviorRestrictionScope.TRANSACTIONS,
        status: BehaviorRestrictionStatus.ACTIVE,
        reasonCode: 'TEMP_REVIEW',
        reasonSummary: null,
        imposedById: null,
        releasedById: null,
        imposedAt: new Date('2026-04-19T10:00:00.000Z'),
        releasedAt: null,
        expiresAt: new Date('2026-04-20T10:00:00.000Z'),
        metadata: null,
        createdAt: new Date('2026-04-19T10:00:00.000Z'),
        updatedAt: new Date('2026-04-19T10:00:00.000Z'),
      },
    ]);

    prismaMock.behaviorRestriction.update.mockResolvedValue({
      id: 'r-expired',
      status: BehaviorRestrictionStatus.EXPIRED,
    });

    prismaMock.behaviorRestriction.count.mockResolvedValue(0);
    prismaMock.userTrustProfile.update.mockResolvedValue({
      id: 'profile1',
      userId: 'user1',
      activeRestrictionCount: 0,
      status: TrustProfileStatus.NORMAL,
    });

    const result = await service.expireDueRestrictions('admin1');

    expect(result.successCount).toBe(1);
    expect(prismaMock.behaviorRestriction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r-expired' },
        data: expect.objectContaining({
          status: BehaviorRestrictionStatus.EXPIRED,
          releasedById: 'admin1',
        }),
      }),
    );
    expect(prismaMock.userTrustProfile.update).toHaveBeenCalled();
  });

  describe('getTrustProfile', () => {
    const baseUser = {
      id: 'user1',
      kycStatus: 'VERIFIED',
      deliverySuccessCount: 6,
      cancellationCount: 1,
      disputeCount: 0,
      averageRating: 4.8,
      reviewCount: 4,
    };

    it('returns enriched profile with VERIFIED_TRAVELER, EXPERIENCED, and TRUSTED badges', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.getTrustProfile('user1');

      expect(result.badges).toContain('VERIFIED_TRAVELER');
      expect(result.badges).toContain('EXPERIENCED');
      expect(result.badges).toContain('TRUSTED');
      expect(result.averageRating).toBe(4.8);
      expect(result.reviewCount).toBe(4);
      expect(typeof result.reliabilityScore).toBe('number');
      expect(result.reliabilityScore).toBeGreaterThanOrEqual(0);
      expect(result.reliabilityScore).toBeLessThanOrEqual(100);
    });

    it('omits EXPERIENCED badge when deliverySuccessCount < 5', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...baseUser,
        deliverySuccessCount: 3,
      });

      const result = await service.getTrustProfile('user1');

      expect(result.badges).not.toContain('EXPERIENCED');
    });

    it('omits TRUSTED badge when averageRating < 4.5', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...baseUser,
        averageRating: 4.2,
      });

      const result = await service.getTrustProfile('user1');

      expect(result.badges).not.toContain('TRUSTED');
    });

    it('omits TRUSTED badge when reviewCount < 3', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...baseUser,
        reviewCount: 2,
      });

      const result = await service.getTrustProfile('user1');

      expect(result.badges).not.toContain('TRUSTED');
    });

    it('omits VERIFIED_TRAVELER badge when kycStatus is not VERIFIED', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...baseUser,
        kycStatus: 'PENDING',
      });

      const result = await service.getTrustProfile('user1');

      expect(result.badges).not.toContain('VERIFIED_TRAVELER');
    });

    it('throws NotFoundException when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getTrustProfile('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('clamps reliabilityScore to 0 for very negative users', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...baseUser,
        deliverySuccessCount: 0,
        cancellationCount: 20,
        disputeCount: 10,
      });

      const result = await service.getTrustProfile('user1');

      expect(result.reliabilityScore).toBe(0);
    });
  });
});