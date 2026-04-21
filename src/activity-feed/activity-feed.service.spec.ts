import {
  PaymentStatus,
  TransactionStatus,
} from '@prisma/client';
import { ActivityFeedService } from './activity-feed.service';
import {
  ActivityFeedSeverity,
  ActivityFeedSourceType,
} from './dto/list-activity-feed-query.dto';

describe('ActivityFeedService', () => {
  let service: ActivityFeedService;

  const prismaMock = {
    transaction: {
      findMany: jest.fn(),
    },
    dispute: {
      findMany: jest.fn(),
    },
    amlCase: {
      findMany: jest.fn(),
    },
    behaviorRestriction: {
      findMany: jest.fn(),
    },
    payout: {
      findMany: jest.fn(),
    },
    refund: {
      findMany: jest.fn(),
    },
    adminActionAudit: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ActivityFeedService(prismaMock as any);
  });

  it('returns unified user activity feed in paginated format', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx1',
        senderId: 'user1',
        travelerId: 'traveler1',
        status: TransactionStatus.PAID,
        paymentStatus: PaymentStatus.SUCCESS,
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        updatedAt: new Date('2099-01-01T01:00:00.000Z'),
        amount: 1000,
        currency: 'XAF',
      },
    ]);

    prismaMock.dispute.findMany.mockResolvedValue([]);
    prismaMock.amlCase.findMany.mockResolvedValue([]);
    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);
    prismaMock.payout.findMany.mockResolvedValue([]);
    prismaMock.refund.findMany.mockResolvedValue([]);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([]);

    const result = await service.listMyFeed('user1', { limit: 20, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].sourceType).toBe(ActivityFeedSourceType.TRANSACTION);
    expect(result.items[0].transactionId).toBe('tx1');
  });

  it('returns admin feed with notification and case actions in paginated format', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([]);
    prismaMock.dispute.findMany.mockResolvedValue([]);
    prismaMock.amlCase.findMany.mockResolvedValue([]);
    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);
    prismaMock.payout.findMany.mockResolvedValue([]);
    prismaMock.refund.findMany.mockResolvedValue([]);

    prismaMock.adminActionAudit.findMany
      .mockResolvedValueOnce([
        {
          id: 'audit-notif',
          action: 'NOTIFICATION_EMIT',
          targetType: 'NOTIFICATION',
          targetId: 'notif1',
          actorUserId: 'admin1',
          metadata: {
            recipientUserId: 'user1',
            title: 'Case update',
            message: 'Your case has moved',
            severity: 'WARNING',
            contextType: 'TRANSACTION',
            contextId: 'tx1',
          },
          createdAt: new Date('2099-01-02T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'audit-case',
          action: 'CASE_TAKE',
          targetType: 'AML',
          targetId: 'aml1',
          actorUserId: 'admin1',
          metadata: {
            title: 'AML case REQUIRE_REVIEW',
            transactionId: 'tx2',
            subjectUserId: 'sender1',
            secondaryUserId: 'traveler1',
            note: 'Taking ownership',
          },
          createdAt: new Date('2099-01-03T00:00:00.000Z'),
        },
      ]);

    const result = await service.listAdminFeed({ limit: 20, offset: 0 });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.sourceType)).toEqual(
      expect.arrayContaining([
        ActivityFeedSourceType.NOTIFICATION,
        ActivityFeedSourceType.CASE_MANAGEMENT,
      ]),
    );
  });

  it('filters user feed by sourceType, severity and q', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx1',
        senderId: 'user1',
        travelerId: 'traveler1',
        status: TransactionStatus.DISPUTED,
        paymentStatus: PaymentStatus.SUCCESS,
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        updatedAt: new Date('2099-01-01T01:00:00.000Z'),
        amount: 1000,
        currency: 'XAF',
      },
    ]);

    prismaMock.dispute.findMany.mockResolvedValue([]);
    prismaMock.amlCase.findMany.mockResolvedValue([]);
    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);
    prismaMock.payout.findMany.mockResolvedValue([]);
    prismaMock.refund.findMany.mockResolvedValue([]);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([]);

    const result = await service.listMyFeed('user1', {
      sourceType: ActivityFeedSourceType.TRANSACTION,
      severity: ActivityFeedSeverity.WARNING,
      q: 'disputed',
      limit: 20,
      offset: 0,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].severity).toBe(ActivityFeedSeverity.WARNING);
  });
});