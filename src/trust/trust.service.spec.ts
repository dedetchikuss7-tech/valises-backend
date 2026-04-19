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
      kind: 'BLOCK_MESSAGING',
      scope: BehaviorRestrictionScope.MESSAGING,
      status: BehaviorRestrictionStatus.ACTIVE,
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
        kind: 'BLOCK_MESSAGING' as any,
        scope: BehaviorRestrictionScope.MESSAGING,
        reasonCode: 'MESSAGE_ABUSE',
      },
      'admin1',
    );

    expect(result.restriction.id).toBe('r1');
    expect(result.profile.status).toBe(TrustProfileStatus.RESTRICTED);
  });
});