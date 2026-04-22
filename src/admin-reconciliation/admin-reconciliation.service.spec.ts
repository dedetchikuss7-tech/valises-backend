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

    const result = await service.getSummary();

    expect(result.totalPayoutRows).toBe(1);
    expect(result.totalRefundRows).toBe(1);
    expect(result.pendingRows).toBe(1);
    expect(result.failedRows).toBe(1);
    expect(result.mismatchRows).toBe(0);
    expect(result.requiresActionCount).toBe(2);
  });

  it('returns consolidated reconciliation rows in paginated format with mismatch signals', async () => {
    prismaMock.payout.findMany.mockResolvedValue([
      {
        id: 'pay1',
        status: PayoutStatus.PAID,
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
        status: RefundStatus.REFUNDED,
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
          status: TransactionStatus.DELIVERED,
          paymentStatus: PaymentStatus.SUCCESS,
        },
      },
    ]);

    const result = await service.listCases({ limit: 20, offset: 0 });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it('filters reconciliation rows by status and q', async () => {
    prismaMock.payout.findMany.mockResolvedValue([
      {
        id: 'pay1',
        status: PayoutStatus.FAILED,
        provider: 'MANUAL',
        createdAt: new Date('2099-01-03T00:00:00.000Z'),
        updatedAt: new Date('2099-01-03T01:00:00.000Z'),
        transactionId: 'tx1',
        amount: 1000,
        currency: 'XAF',
        railProvider: null,
        payoutMethodType: null,
        failureReason: 'failed',
        transaction: {
          id: 'tx1',
          senderId: 'sender1',
          travelerId: 'traveler1',
          status: TransactionStatus.DELIVERED,
          paymentStatus: PaymentStatus.SUCCESS,
        },
      },
    ]);

    prismaMock.refund.findMany.mockResolvedValue([]);

    const result = await service.listCases({
      status: AdminReconciliationDerivedStatus.FAILED,
      q: 'manual',
      limit: 20,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
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

    const result = await service.listCases({
      sortBy: AdminReconciliationSortBy.AMOUNT,
      sortOrder: SortOrder.ASC,
      limit: 20,
      offset: 0,
    });

    expect(result.total).toBe(2);
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
    prismaMock.adminActionAudit.create.mockResolvedValue({ id: 'audit1' });

    const result = await service.bulkMarkReviewed('admin1', {
      items: [{ caseType: AdminReconciliationCaseType.PAYOUT, caseId: 'pay1' }],
      note: 'reviewed',
    });

    expect(result.requestedCount).toBe(1);
    expect(result.successCount).toBe(1);
    expect(prismaMock.adminActionAudit.create).toHaveBeenCalled();
  });
});