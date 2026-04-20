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

  it('returns consolidated reconciliation rows with mismatch signals', async () => {
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

    const result = await service.listCases({ limit: 20 });

    expect(result).toHaveLength(2);

    const payoutCase = result.find(
      (row) => row.caseType === AdminReconciliationCaseType.PAYOUT,
    );
    const refundCase = result.find(
      (row) => row.caseType === AdminReconciliationCaseType.REFUND,
    );

    expect(payoutCase?.derivedStatus).toBe(
      AdminReconciliationDerivedStatus.MISMATCH,
    );
    expect(payoutCase?.mismatchSignals).toContain(
      'PAYOUT_COMPLETED_BEFORE_DELIVERY_CONFIRMED',
    );

    expect(refundCase?.derivedStatus).toBe(
      AdminReconciliationDerivedStatus.MISMATCH,
    );
    expect(refundCase?.mismatchSignals).toContain(
      'REFUND_COMPLETED_ON_DELIVERED_TRANSACTION',
    );
  });

  it('filters reconciliation rows by requiresAction', async () => {
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
          status: TransactionStatus.DELIVERED,
          paymentStatus: PaymentStatus.SUCCESS,
        },
      },
    ]);

    prismaMock.refund.findMany.mockResolvedValue([]);

    const result = await service.listCases({
      requiresAction: true,
      limit: 20,
    });

    expect(result).toEqual([]);
  });

  it('filters reconciliation rows by derived status', async () => {
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
      limit: 20,
    });

    expect(result).toHaveLength(1);
    expect(result[0].derivedStatus).toBe(
      AdminReconciliationDerivedStatus.FAILED,
    );
  });
});