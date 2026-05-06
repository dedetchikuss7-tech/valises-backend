import {
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
  TransactionStatus,
} from '@prisma/client';
import { AdminReconciliationService } from './admin-reconciliation.service';
import {
  AdminReconciliationCaseType,
  AdminReconciliationDerivedStatus,
  AdminReconciliationRecommendedAction,
  AdminReconciliationSortBy,
  AdminReconciliationUrgencyLevel,
  SortOrder,
} from './dto/list-admin-reconciliation-cases-query.dto';

describe('AdminReconciliationService', () => {
  let service: AdminReconciliationService;

  const prismaMock = {
    payout: {
      findMany: jest.fn(),
    },
    refund: {
      findMany: jest.fn(),
    },
    adminActionAudit: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminReconciliationService(prismaMock as any);
  });

  it('returns enriched reconciliation summary', async () => {
    prismaMock.payout.findMany.mockResolvedValue([
      payoutRow({
        id: 'pay1',
        status: PayoutStatus.REQUESTED,
        updatedAt: hoursAgo(2),
      }),
    ]);

    prismaMock.refund.findMany.mockResolvedValue([
      refundRow({
        id: 'ref1',
        status: RefundStatus.FAILED,
        updatedAt: hoursAgo(3),
      }),
    ]);

    prismaMock.adminActionAudit.findMany.mockResolvedValue([]);

    const result = await service.getSummary();

    expect(result.totalPayoutRows).toBe(1);
    expect(result.totalRefundRows).toBe(1);
    expect(result.pendingRows).toBe(1);
    expect(result.failedRows).toBe(1);
    expect(result.requiresActionCount).toBe(2);
    expect(result.highUrgencyRows).toBe(1);
    expect(result.mediumUrgencyRows).toBe(1);
    expect(result.unreviewedRows).toBe(2);
  });

  it('attaches last review visibility fields and reviewed status', async () => {
    prismaMock.payout.findMany.mockResolvedValue([
      payoutRow({
        id: 'pay1',
        status: PayoutStatus.REQUESTED,
        updatedAt: hoursAgo(2),
      }),
    ]);
    prismaMock.refund.findMany.mockResolvedValue([]);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([
      {
        targetType: AdminReconciliationCaseType.PAYOUT,
        targetId: 'pay1',
        actorUserId: 'admin1',
        action: 'RECONCILIATION_REVIEW',
        createdAt: new Date('2099-01-04T00:00:00.000Z'),
      },
    ]);

    const result = await service.listCases({ limit: 20, offset: 0 });

    expect(result.items[0].isReviewed).toBe(true);
    expect(result.items[0].adminActionCount).toBe(1);
    expect(result.items[0].lastAdminActionBy).toBe('admin1');
    expect(result.items[0].recommendedAction).toBe(
      AdminReconciliationRecommendedAction.REVIEW_ALREADY_ACKNOWLEDGED_CASE,
    );
  });

  it('sorts reconciliation rows by amount ascending', async () => {
    prismaMock.payout.findMany.mockResolvedValue([
      payoutRow({
        id: 'pay1',
        amount: 1000,
        status: PayoutStatus.REQUESTED,
      }),
    ]);
    prismaMock.refund.findMany.mockResolvedValue([
      refundRow({
        id: 'ref1',
        amount: 500,
        status: RefundStatus.REQUESTED,
      }),
    ]);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([]);

    const result = await service.listCases({
      sortBy: AdminReconciliationSortBy.AMOUNT,
      sortOrder: SortOrder.ASC,
      limit: 20,
      offset: 0,
    });

    expect(result.items[0].amount).toBe(500);
  });

  it('filters by urgency level and recommended action', async () => {
    prismaMock.payout.findMany.mockResolvedValue([
      payoutRow({
        id: 'pay1',
        status: PayoutStatus.PAID,
        transactionStatus: TransactionStatus.PAID,
        updatedAt: hoursAgo(1),
      }),
    ]);
    prismaMock.refund.findMany.mockResolvedValue([
      refundRow({
        id: 'ref1',
        status: RefundStatus.REQUESTED,
        updatedAt: new Date(),
      }),
    ]);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([]);

    const result = await service.listCases({
      urgencyLevel: AdminReconciliationUrgencyLevel.HIGH,
      recommendedAction:
        AdminReconciliationRecommendedAction.INVESTIGATE_RECONCILIATION_MISMATCH,
      limit: 20,
      offset: 0,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].caseId).toBe('pay1');
    expect(result.items[0].derivedStatus).toBe(
      AdminReconciliationDerivedStatus.MISMATCH,
    );
  });

  it('filters reviewed and unreviewed rows', async () => {
    prismaMock.payout.findMany.mockResolvedValue([
      payoutRow({
        id: 'pay1',
        status: PayoutStatus.REQUESTED,
      }),
    ]);
    prismaMock.refund.findMany.mockResolvedValue([
      refundRow({
        id: 'ref1',
        status: RefundStatus.REQUESTED,
      }),
    ]);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([
      {
        targetType: AdminReconciliationCaseType.PAYOUT,
        targetId: 'pay1',
        actorUserId: 'admin1',
        action: 'RECONCILIATION_REVIEW',
        createdAt: new Date('2099-01-04T00:00:00.000Z'),
      },
    ]);

    const reviewed = await service.listCases({
      isReviewed: true,
      limit: 20,
      offset: 0,
    });

    const unreviewed = await service.listCases({
      isReviewed: false,
      limit: 20,
      offset: 0,
    });

    expect(reviewed.items).toHaveLength(1);
    expect(reviewed.items[0].caseId).toBe('pay1');
    expect(unreviewed.items).toHaveLength(1);
    expect(unreviewed.items[0].caseId).toBe('ref1');
  });

  it('bulk marks reconciliation rows as reviewed with operational metadata', async () => {
    prismaMock.payout.findMany.mockResolvedValue([
      payoutRow({
        id: 'pay1',
        status: PayoutStatus.REQUESTED,
      }),
    ]);
    prismaMock.refund.findMany.mockResolvedValue([]);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([]);
    prismaMock.adminActionAudit.create.mockResolvedValue({ id: 'audit1' });

    const result = await service.bulkMarkReviewed('admin1', {
      items: [{ caseType: AdminReconciliationCaseType.PAYOUT, caseId: 'pay1' }],
      note: 'reviewed',
    });

    expect(result.successCount).toBe(1);
    expect(prismaMock.adminActionAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'RECONCILIATION_REVIEW',
        targetType: AdminReconciliationCaseType.PAYOUT,
        targetId: 'pay1',
        actorUserId: 'admin1',
        metadata: expect.objectContaining({
          derivedStatus: AdminReconciliationDerivedStatus.PENDING,
          urgencyLevel: expect.any(String),
          recommendedAction: expect.any(String),
          note: 'reviewed',
        }),
      }),
    });
  });

  it('returns partial failure for unknown bulk review rows', async () => {
    prismaMock.payout.findMany.mockResolvedValue([]);
    prismaMock.refund.findMany.mockResolvedValue([]);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([]);

    const result = await service.bulkMarkReviewed('admin1', {
      items: [{ caseType: AdminReconciliationCaseType.PAYOUT, caseId: 'missing' }],
      note: 'reviewed',
    });

    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(1);
  });
});

function payoutRow(input: {
  id: string;
  status: PayoutStatus;
  amount?: number;
  updatedAt?: Date;
  transactionStatus?: TransactionStatus;
}) {
  return {
    id: input.id,
    status: input.status,
    provider: 'MANUAL',
    createdAt: new Date('2099-01-03T00:00:00.000Z'),
    updatedAt: input.updatedAt ?? new Date('2099-01-03T01:00:00.000Z'),
    transactionId: `tx-${input.id}`,
    amount: input.amount ?? 1000,
    currency: 'XAF',
    railProvider: null,
    payoutMethodType: null,
    failureReason: null,
    transaction: {
      id: `tx-${input.id}`,
      senderId: `sender-${input.id}`,
      travelerId: `traveler-${input.id}`,
      status: input.transactionStatus ?? TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
    },
  };
}

function refundRow(input: {
  id: string;
  status: RefundStatus;
  amount?: number;
  updatedAt?: Date;
  transactionStatus?: TransactionStatus;
}) {
  return {
    id: input.id,
    status: input.status,
    provider: 'MANUAL',
    createdAt: new Date('2099-01-02T00:00:00.000Z'),
    updatedAt: input.updatedAt ?? new Date('2099-01-02T01:00:00.000Z'),
    transactionId: `tx-${input.id}`,
    amount: input.amount ?? 500,
    currency: 'XAF',
    failureReason: null,
    transaction: {
      id: `tx-${input.id}`,
      senderId: `sender-${input.id}`,
      travelerId: `traveler-${input.id}`,
      status: input.transactionStatus ?? TransactionStatus.CANCELLED,
      paymentStatus: PaymentStatus.SUCCESS,
    },
  };
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}