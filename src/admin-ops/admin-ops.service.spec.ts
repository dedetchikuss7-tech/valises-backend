import {
  AbandonmentEventStatus,
  AmlCaseStatus,
  BehaviorRestrictionStatus,
  DisputeStatus,
  PayoutStatus,
  RefundStatus,
} from '@prisma/client';
import { AdminOpsService } from './admin-ops.service';
import { AdminOpsCaseType } from './dto/list-admin-ops-cases-query.dto';

describe('AdminOpsService', () => {
  let service: AdminOpsService;

  const prismaMock = {
    amlCase: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    dispute: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    behaviorRestriction: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    payout: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    refund: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    abandonmentEvent: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    reminderJob: {
      count: jest.fn(),
    },
    packageTripShortlist: {
      count: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminOpsService(prismaMock as any);
  });

  it('returns consolidated dashboard counts', async () => {
    prismaMock.amlCase.count.mockResolvedValue(2);
    prismaMock.dispute.count.mockResolvedValue(3);
    prismaMock.behaviorRestriction.count.mockResolvedValue(4);
    prismaMock.payout.count.mockResolvedValue(1);
    prismaMock.refund.count.mockResolvedValue(2);
    prismaMock.abandonmentEvent.count.mockResolvedValue(5);
    prismaMock.reminderJob.count.mockResolvedValue(6);
    prismaMock.packageTripShortlist.count.mockResolvedValue(7);

    const result = await service.getDashboard();

    expect(result.openAmlCases).toBe(2);
    expect(result.openDisputes).toBe(3);
    expect(result.activeRestrictions).toBe(4);
    expect(result.pendingPayouts).toBe(1);
    expect(result.pendingRefunds).toBe(2);
    expect(result.activeAbandonmentEvents).toBe(5);
    expect(result.pendingReminderJobs).toBe(6);
    expect(result.visibleShortlistEntries).toBe(7);
    expect(result.requiresActionCount).toBe(23);
  });

  it('returns a paginated unified consolidated case list', async () => {
    prismaMock.amlCase.findMany.mockResolvedValue([
      {
        id: 'aml1',
        status: AmlCaseStatus.OPEN,
        riskLevel: 'HIGH',
        currentAction: 'REQUIRE_REVIEW',
        openedAt: new Date('2099-01-05T00:00:00.000Z'),
        updatedAt: new Date('2099-01-05T01:00:00.000Z'),
        transactionId: 'tx1',
        senderId: 'sender1',
        travelerId: 'traveler1',
        reasonSummary: 'AML review required',
        signalCount: 2,
        reviewedById: null,
      },
    ]);

    prismaMock.dispute.findMany.mockResolvedValue([
      {
        id: 'disp1',
        status: DisputeStatus.OPEN,
        reasonCode: 'NOT_DELIVERED',
        reason: 'Package not delivered',
        openingSource: 'MANUAL',
        evidenceStatus: 'NOT_REVIEWED',
        openedById: 'sender1',
        createdAt: new Date('2099-01-04T00:00:00.000Z'),
        updatedAt: new Date('2099-01-04T01:00:00.000Z'),
        transactionId: 'tx2',
        transaction: {
          senderId: 'sender1',
          travelerId: 'traveler2',
        },
        resolution: null,
      },
    ]);

    prismaMock.behaviorRestriction.findMany.mockResolvedValue([
      {
        id: 'res1',
        status: BehaviorRestrictionStatus.ACTIVE,
        kind: 'LIMIT_TRANSACTIONS',
        scope: 'TRANSACTIONS',
        imposedAt: new Date('2099-01-03T00:00:00.000Z'),
        updatedAt: new Date('2099-01-03T01:00:00.000Z'),
        userId: 'user1',
        reasonSummary: 'Restricted',
        reasonCode: 'AML_BLOCK:tx1',
        imposedById: null,
        releasedById: null,
      },
    ]);

    prismaMock.payout.findMany.mockResolvedValue([
      {
        id: 'pay1',
        status: PayoutStatus.REQUESTED,
        provider: 'MANUAL',
        failureReason: null,
        createdAt: new Date('2099-01-02T00:00:00.000Z'),
        updatedAt: new Date('2099-01-02T01:00:00.000Z'),
        transactionId: 'tx3',
        amount: 1000,
        currency: 'XAF',
        railProvider: null,
        payoutMethodType: null,
        transaction: {
          senderId: 'sender3',
          travelerId: 'traveler3',
        },
      },
    ]);

    prismaMock.refund.findMany.mockResolvedValue([
      {
        id: 'ref1',
        status: RefundStatus.FAILED,
        provider: 'MANUAL',
        failureReason: 'Provider failed',
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        updatedAt: new Date('2099-01-01T01:00:00.000Z'),
        transactionId: 'tx4',
        amount: 500,
        currency: 'XAF',
        transaction: {
          senderId: 'sender4',
          travelerId: 'traveler4',
        },
      },
    ]);

    prismaMock.abandonmentEvent.findMany.mockResolvedValue([
      {
        id: 'ab1',
        kind: 'PAYMENT_PENDING',
        status: AbandonmentEventStatus.ACTIVE,
        userId: 'user5',
        tripId: null,
        packageId: null,
        transactionId: 'tx5',
        abandonedAt: new Date('2098-12-31T00:00:00.000Z'),
        updatedAt: new Date('2098-12-31T01:00:00.000Z'),
        reminderJobs: [
          {
            id: 'job1',
            status: 'PENDING',
            scheduledFor: new Date('2099-01-01T12:00:00.000Z'),
          },
        ],
      },
    ]);

    const result = await service.listCases({ limit: 20, offset: 0 });

    expect(result.items).toHaveLength(6);
    expect(result.total).toBe(6);
    expect(result.items[0].caseType).toBe(AdminOpsCaseType.AML);
  });

  it('filters consolidated results by requiresAction and q', async () => {
    prismaMock.amlCase.findMany.mockResolvedValue([
      {
        id: 'aml1',
        status: AmlCaseStatus.RESOLVED,
        riskLevel: 'LOW',
        currentAction: 'ALLOW',
        openedAt: new Date('2099-01-05T00:00:00.000Z'),
        updatedAt: new Date('2099-01-05T01:00:00.000Z'),
        transactionId: 'tx1',
        senderId: 'sender1',
        travelerId: 'traveler1',
        reasonSummary: null,
        signalCount: 0,
        reviewedById: 'admin1',
      },
    ]);

    prismaMock.dispute.findMany.mockResolvedValue([]);
    prismaMock.behaviorRestriction.findMany.mockResolvedValue([]);
    prismaMock.payout.findMany.mockResolvedValue([]);
    prismaMock.refund.findMany.mockResolvedValue([]);
    prismaMock.abandonmentEvent.findMany.mockResolvedValue([]);

    const result = await service.listCases({
      requiresAction: false,
      q: 'allow',
      limit: 20,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });
});