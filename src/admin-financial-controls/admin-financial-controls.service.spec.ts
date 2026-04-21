import {
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
  TransactionStatus,
} from '@prisma/client';
import { AdminFinancialControlsService } from './admin-financial-controls.service';
import { AdminFinancialControlStatus } from './dto/list-admin-financial-controls-query.dto';

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
    expect(result.warningRows).toBe(0);
    expect(result.breachRows).toBe(0);
    expect(result.requiresActionCount).toBe(0);
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

    const result = await service.listControls({ limit: 20 });

    expect(result).toHaveLength(1);
    expect(result[0].derivedStatus).toBe(AdminFinancialControlStatus.WARNING);
    expect(result[0].mismatchSignals).toContain('MISSING_LEDGER_COVERAGE');
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

    const result = await service.listControls({ limit: 20 });

    expect(result).toHaveLength(1);
    expect(result[0].derivedStatus).toBe(AdminFinancialControlStatus.BREACH);
    expect(result[0].mismatchSignals).toContain('OVER_PAYOUT');
  });

  it('filters rows by derived status', async () => {
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
      limit: 20,
    });

    expect(result).toHaveLength(1);
    expect(result[0].derivedStatus).toBe(AdminFinancialControlStatus.BREACH);
  });
});