import {
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
  TransactionStatus,
} from '@prisma/client';
import { AdminFinancialControlsService } from './admin-financial-controls.service';
import {
  AdminFinancialControlsSortBy,
  AdminFinancialControlStatus,
  SortOrder,
} from './dto/list-admin-financial-controls-query.dto';

describe('AdminFinancialControlsService', () => {
  let service: AdminFinancialControlsService;

  const prismaMock = {
    transaction: {
      findMany: jest.fn(),
    },
    ledgerEntry: {
      findMany: jest.fn(),
    },
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
    service = new AdminFinancialControlsService(prismaMock as any);
  });

  it('returns financial controls summary', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx1',
        amount: 1000,
        currency: 'XAF',
        status: TransactionStatus.DELIVERED,
        paymentStatus: PaymentStatus.SUCCESS,
        senderId: 'sender1',
        travelerId: 'traveler1',
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        updatedAt: new Date('2099-01-01T01:00:00.000Z'),
      },
    ]);

    prismaMock.ledgerEntry.findMany.mockResolvedValue([
      {
        id: 'l1',
        type: 'ESCROW_CREDIT',
        amount: 1000,
        currency: 'XAF',
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        source: 'PAYMENT',
        referenceType: 'TRANSACTION',
        referenceId: 'tx1',
      },
      {
        id: 'l2',
        type: 'ESCROW_DEBIT_RELEASE',
        amount: 1000,
        currency: 'XAF',
        createdAt: new Date('2099-01-02T00:00:00.000Z'),
        source: 'PAYOUT',
        referenceType: 'TRANSACTION',
        referenceId: 'tx1',
      },
    ]);

    prismaMock.payout.findMany.mockResolvedValue([
      {
        id: 'p1',
        status: PayoutStatus.PAID,
        amount: 1000,
        currency: 'XAF',
        provider: 'MANUAL',
        railProvider: null,
        payoutMethodType: null,
        failureReason: null,
      },
    ]);

    prismaMock.refund.findMany.mockResolvedValue([]);

    const result = await service.getSummary();

    expect(result.totalRows).toBe(1);
    expect(result.cleanRows).toBe(1);
  });

  it('returns warning when ledger coverage is missing for successful payment', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx1',
        amount: 1000,
        currency: 'XAF',
        status: TransactionStatus.PAID,
        paymentStatus: PaymentStatus.SUCCESS,
        senderId: 'sender1',
        travelerId: 'traveler1',
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        updatedAt: new Date('2099-01-01T01:00:00.000Z'),
      },
    ]);

    prismaMock.ledgerEntry.findMany.mockResolvedValue([]);
    prismaMock.payout.findMany.mockResolvedValue([]);
    prismaMock.refund.findMany.mockResolvedValue([]);

    const result = await service.listControls({ limit: 20, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.items[0].derivedStatus).toBe(AdminFinancialControlStatus.WARNING);
  });

  it('returns breach when payout exceeds credited ledger amount', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx1',
        amount: 1000,
        currency: 'XAF',
        status: TransactionStatus.DELIVERED,
        paymentStatus: PaymentStatus.SUCCESS,
        senderId: 'sender1',
        travelerId: 'traveler1',
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        updatedAt: new Date('2099-01-01T01:00:00.000Z'),
      },
    ]);

    prismaMock.ledgerEntry.findMany.mockResolvedValue([
      {
        id: 'l1',
        type: 'ESCROW_CREDIT',
        amount: 1000,
        currency: 'XAF',
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        source: 'PAYMENT',
        referenceType: 'TRANSACTION',
        referenceId: 'tx1',
      },
    ]);

    prismaMock.payout.findMany.mockResolvedValue([
      {
        id: 'p1',
        status: PayoutStatus.PAID,
        amount: 1200,
        currency: 'XAF',
        provider: 'MANUAL',
        railProvider: null,
        payoutMethodType: null,
        failureReason: null,
      },
    ]);

    prismaMock.refund.findMany.mockResolvedValue([]);

    const result = await service.listControls({ limit: 20, offset: 0 });

    expect(result.items[0].derivedStatus).toBe(AdminFinancialControlStatus.BREACH);
  });

  it('filters rows by derived status and q', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx1',
        amount: 1000,
        currency: 'XAF',
        status: TransactionStatus.DELIVERED,
        paymentStatus: PaymentStatus.SUCCESS,
        senderId: 'sender1',
        travelerId: 'traveler1',
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        updatedAt: new Date('2099-01-01T01:00:00.000Z'),
      },
    ]);

    prismaMock.ledgerEntry.findMany.mockResolvedValue([
      {
        id: 'l1',
        type: 'ESCROW_CREDIT',
        amount: 1000,
        currency: 'XAF',
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        source: 'PAYMENT',
        referenceType: 'TRANSACTION',
        referenceId: 'tx1',
      },
    ]);

    prismaMock.payout.findMany.mockResolvedValue([
      {
        id: 'p1',
        status: PayoutStatus.PAID,
        amount: 1200,
        currency: 'XAF',
        provider: 'MANUAL',
        railProvider: null,
        payoutMethodType: null,
        failureReason: null,
      },
    ]);

    prismaMock.refund.findMany.mockResolvedValue([]);

    const result = await service.listControls({
      status: AdminFinancialControlStatus.BREACH,
      q: 'over_payout',
      limit: 20,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it('sorts rows by transaction amount ascending', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx1',
        amount: 1000,
        currency: 'XAF',
        status: TransactionStatus.PAID,
        paymentStatus: PaymentStatus.SUCCESS,
        senderId: 'sender1',
        travelerId: 'traveler1',
        createdAt: new Date('2099-01-02T00:00:00.000Z'),
        updatedAt: new Date('2099-01-02T01:00:00.000Z'),
      },
      {
        id: 'tx2',
        amount: 500,
        currency: 'XAF',
        status: TransactionStatus.PAID,
        paymentStatus: PaymentStatus.SUCCESS,
        senderId: 'sender2',
        travelerId: 'traveler2',
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        updatedAt: new Date('2099-01-01T01:00:00.000Z'),
      },
    ]);

    prismaMock.ledgerEntry.findMany.mockResolvedValue([]);
    prismaMock.payout.findMany.mockResolvedValue([]);
    prismaMock.refund.findMany.mockResolvedValue([]);

    const result = await service.listControls({
      sortBy: AdminFinancialControlsSortBy.TRANSACTION_AMOUNT,
      sortOrder: SortOrder.ASC,
      limit: 20,
      offset: 0,
    });

    expect(result.total).toBe(2);
    expect(result.items[0].transactionAmount).toBe(500);
  });

  it('bulk acknowledges financial control rows', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx1',
        amount: 1000,
        currency: 'XAF',
        status: TransactionStatus.PAID,
        paymentStatus: PaymentStatus.SUCCESS,
        senderId: 'sender1',
        travelerId: 'traveler1',
        createdAt: new Date('2099-01-02T00:00:00.000Z'),
        updatedAt: new Date('2099-01-02T01:00:00.000Z'),
      },
    ]);
    prismaMock.ledgerEntry.findMany.mockResolvedValue([]);
    prismaMock.payout.findMany.mockResolvedValue([]);
    prismaMock.refund.findMany.mockResolvedValue([]);
    prismaMock.adminActionAudit.create.mockResolvedValue({ id: 'audit1' });

    const result = await service.bulkAcknowledgeControls('admin1', {
      items: [{ transactionId: 'tx1' }],
      note: 'acked',
    });

    expect(result.requestedCount).toBe(1);
    expect(result.successCount).toBe(1);
    expect(prismaMock.adminActionAudit.create).toHaveBeenCalled();
  });
});