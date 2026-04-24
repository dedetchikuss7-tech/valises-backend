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
  AdminReconciliationSortBy,
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

  it('returns reconciliation summary', async () => {
    prismaMock.payout.findMany.mockResolvedValue([
      {
        id: 'pay1',
        status: PayoutStatus.REQUESTED,
        provider: 'MANUAL',
        createdAt: new Date('2099-01-03T00:00:00.000Z'),
        updatedAt: new Date('2099-01-03T01:00:00.000Z'),
        transactionId: 'tx1',
        amount: 1000,
        currency: 'XAF',
        railProvider: null,
        payoutMethodType: null,
        failureReason: null,
        transaction: {
          id: 'tx1',
          senderId: 'sender1',
          travelerId: 'traveler1',
          status: TransactionStatus.PAID,
          paymentStatus: PaymentStatus.SUCCESS,
        },
      },
    ]);

    prismaMock.refund.findMany.mockResolvedValue([
      {
        id: 'ref1',
        status: RefundStatus.FAILED,
        provider: 'MANUAL',
        createdAt: new Date('2099-01-02T00:00:00.000Z'),
        updatedAt: new Date('2099-01-02T01:00:00.000Z'),
        transactionId: 'tx2',
        amount: 500,
        currency: 'XAF',
        failureReason: 'Provider failed',
        transaction: {
          id: 'tx2',
          senderId: 'sender2',
          travelerId: 'traveler2',
          status: TransactionStatus.CANCELLED,
          paymentStatus: PaymentStatus.SUCCESS,
        },
      },
    ]);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([]);

    const result = await service.getSummary();

    expect(result.totalPayoutRows).toBe(1);
    expect(result.totalRefundRows).toBe(1);
  });

  it('attaches last review visibility fields', async () => {
    prismaMock.payout.findMany.mockResolvedValue([
      {
        id: 'pay1',
        status: PayoutStatus.REQUESTED,
        provider: 'MANUAL',
        createdAt: new Date('2099-01-03T00:00:00.000Z'),
        updatedAt: new Date('2099-01-03T01:00:00.000Z'),
        transactionId: 'tx1',
        amount: 1000,
        currency: 'XAF',
        railProvider: null,
        payoutMethodType: null,
        failureReason: null,
        transaction: {
          id: 'tx1',
          senderId: 'sender1',
          travelerId: 'traveler1',
          status: TransactionStatus.PAID,
          paymentStatus: PaymentStatus.SUCCESS,
        },
      },
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

    expect(result.items[0].adminActionCount).toBe(1);
    expect(result.items[0].lastAdminActionBy).toBe('admin1');
    expect(result.items[0].lastAdminActionType).toBe('RECONCILIATION_REVIEW');
  });

  it('sorts reconciliation rows by amount ascending', async () => {
    prismaMock.payout.findMany.mockResolvedValue([
      {
        id: 'pay1',
        status: PayoutStatus.REQUESTED,
        provider: 'MANUAL',
        createdAt: new Date('2099-01-03T00:00:00.000Z'),
        updatedAt: new Date('2099-01-03T01:00:00.000Z'),
        transactionId: 'tx1',
        amount: 1000,
        currency: 'XAF',
        railProvider: null,
        payoutMethodType: null,
        failureReason: null,
        transaction: {
          id: 'tx1',
          senderId: 'sender1',
          travelerId: 'traveler1',
          status: TransactionStatus.PAID,
          paymentStatus: PaymentStatus.SUCCESS,
        },
      },
    ]);
    prismaMock.refund.findMany.mockResolvedValue([
      {
        id: 'ref1',
        status: RefundStatus.REQUESTED,
        provider: 'MANUAL',
        createdAt: new Date('2099-01-02T00:00:00.000Z'),
        updatedAt: new Date('2099-01-02T01:00:00.000Z'),
        transactionId: 'tx2',
        amount: 500,
        currency: 'XAF',
        failureReason: null,
        transaction: {
          id: 'tx2',
          senderId: 'sender2',
          travelerId: 'traveler2',
          status: TransactionStatus.CANCELLED,
          paymentStatus: PaymentStatus.SUCCESS,
        },
      },
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

  it('bulk marks reconciliation rows as reviewed', async () => {
    prismaMock.payout.findMany.mockResolvedValue([
      {
        id: 'pay1',
        status: PayoutStatus.REQUESTED,
        provider: 'MANUAL',
        createdAt: new Date('2099-01-03T00:00:00.000Z'),
        updatedAt: new Date('2099-01-03T01:00:00.000Z'),
        transactionId: 'tx1',
        amount: 1000,
        currency: 'XAF',
        railProvider: null,
        payoutMethodType: null,
        failureReason: null,
        transaction: {
          id: 'tx1',
          senderId: 'sender1',
          travelerId: 'traveler1',
          status: TransactionStatus.PAID,
          paymentStatus: PaymentStatus.SUCCESS,
        },
      },
    ]);
    prismaMock.refund.findMany.mockResolvedValue([]);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([]);
    prismaMock.adminActionAudit.create.mockResolvedValue({ id: 'audit1' });

    const result = await service.bulkMarkReviewed('admin1', {
      items: [{ caseType: AdminReconciliationCaseType.PAYOUT, caseId: 'pay1' }],
      note: 'reviewed',
    });

    expect(result.successCount).toBe(1);
  });
});