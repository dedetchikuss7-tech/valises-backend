import {
  LedgerEntryType,
  PaymentStatus,
  PayoutStatus,
  RefundStatus,
  TransactionStatus,
} from '@prisma/client';
import { AdminLedgerIntegrityService } from './admin-ledger-integrity.service';
import {
  LedgerIntegritySortBy,
  LedgerIntegrityStatus,
  SortOrder,
} from './dto/list-ledger-mismatches-query.dto';

describe('AdminLedgerIntegrityService', () => {
  let service: AdminLedgerIntegrityService;

  const prismaMock = {
    transaction: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const ledgerMock = {
    getEscrowBalance: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminLedgerIntegrityService(
      prismaMock as any,
      ledgerMock as any,
    );
  });

  it('returns OK integrity for one balanced transaction', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-ok',
      status: TransactionStatus.DELIVERED,
      paymentStatus: PaymentStatus.SUCCESS,
      amount: 1000,
      commission: 100,
      escrowAmount: 1000,
      currency: 'XAF',
      senderId: 'sender1',
      travelerId: 'traveler1',
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
      updatedAt: new Date('2099-01-01T01:00:00.000Z'),
      ledgerEntries: [
        {
          id: 'le1',
          type: LedgerEntryType.ESCROW_CREDIT,
          amount: 1000,
          currency: 'XAF',
          source: 'PAYMENT',
          referenceType: 'TRANSACTION',
          referenceId: 'tx-ok',
          idempotencyKey: 'payment:tx-ok',
          createdAt: new Date('2099-01-01T00:05:00.000Z'),
        },
      ],
      payout: null,
      refund: null,
    });

    ledgerMock.getEscrowBalance.mockResolvedValue(1000);

    const result = await service.getTransactionIntegrity('tx-ok');

    expect(result.integrityStatus).toBe(LedgerIntegrityStatus.OK);
    expect(result.requiresAction).toBe(false);
    expect(result.recommendedAction).toBe('NO_ACTION_REQUIRED');
    expect(result.delta).toBe(0);
  });

  it('detects escrow mismatch and missing escrow credit', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-breach',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
      amount: 1000,
      commission: 100,
      escrowAmount: 1000,
      currency: 'XAF',
      senderId: 'sender1',
      travelerId: 'traveler1',
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
      updatedAt: new Date('2099-01-01T01:00:00.000Z'),
      ledgerEntries: [],
      payout: null,
      refund: null,
    });

    ledgerMock.getEscrowBalance.mockResolvedValue(0);

    const result = await service.getTransactionIntegrity('tx-breach');

    expect(result.integrityStatus).toBe(LedgerIntegrityStatus.BREACH);
    expect(result.requiresAction).toBe(true);
    expect(result.mismatchSignals).toEqual(
      expect.arrayContaining([
        'ESCROW_BALANCE_MISMATCH',
        'PAYMENT_SUCCESS_WITHOUT_ESCROW_CREDIT',
      ]),
    );
    expect(result.recommendedAction).toBe('RECONCILE_TRANSACTION_LEDGER');
  });

  it('lists only non-OK rows by default with summaries', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-ok',
        status: TransactionStatus.DELIVERED,
        paymentStatus: PaymentStatus.SUCCESS,
        amount: 1000,
        commission: 100,
        escrowAmount: 1000,
        currency: 'XAF',
        senderId: 'sender1',
        travelerId: 'traveler1',
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        updatedAt: new Date('2099-01-01T01:00:00.000Z'),
        ledgerEntries: [
          {
            type: LedgerEntryType.ESCROW_CREDIT,
            amount: 1000,
          },
        ],
        payout: null,
        refund: null,
      },
      {
        id: 'tx-mismatch',
        status: TransactionStatus.PAID,
        paymentStatus: PaymentStatus.SUCCESS,
        amount: 1000,
        commission: 100,
        escrowAmount: 1000,
        currency: 'XAF',
        senderId: 'sender2',
        travelerId: 'traveler2',
        createdAt: new Date('2099-01-02T00:00:00.000Z'),
        updatedAt: new Date('2099-01-02T01:00:00.000Z'),
        ledgerEntries: [],
        payout: null,
        refund: null,
      },
    ]);

    const result = await service.listMismatches();

    expect(result.inspectedCount).toBe(2);
    expect(result.mismatchCount).toBe(1);
    expect(result.breachCount).toBe(1);
    expect(result.warningCount).toBe(0);
    expect(result.requiresActionCount).toBe(1);
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].transactionId).toBe('tx-mismatch');
  });

  it('detects paid payout without matching release ledger', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-payout',
        status: TransactionStatus.DELIVERED,
        paymentStatus: PaymentStatus.SUCCESS,
        amount: 1000,
        commission: 100,
        escrowAmount: 1000,
        currency: 'XAF',
        senderId: 'sender1',
        travelerId: 'traveler1',
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        updatedAt: new Date('2099-01-01T02:00:00.000Z'),
        ledgerEntries: [
          {
            type: LedgerEntryType.ESCROW_CREDIT,
            amount: 1000,
          },
        ],
        payout: {
          id: 'po1',
          status: PayoutStatus.PAID,
          amount: 850,
          currency: 'XAF',
          paidAt: new Date('2099-01-01T03:00:00.000Z'),
        },
        refund: null,
      },
    ]);

    const result = await service.listMismatches({
      sortBy: LedgerIntegritySortBy.SIGNAL_COUNT,
      sortOrder: SortOrder.DESC,
    });

    expect(result.items[0].integrityStatus).toBe(LedgerIntegrityStatus.BREACH);
    expect(result.items[0].mismatchSignals).toContain(
      'PAID_PAYOUT_WITHOUT_MATCHING_RELEASE_LEDGER',
    );
    expect(result.items[0].recommendedAction).toBe(
      'REVIEW_PAYOUT_REFUND_LEDGER_LINK',
    );
  });

  it('detects refunded refund without matching refund ledger', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-refund',
        status: TransactionStatus.DISPUTED,
        paymentStatus: PaymentStatus.SUCCESS,
        amount: 1000,
        commission: 100,
        escrowAmount: 1000,
        currency: 'XAF',
        senderId: 'sender1',
        travelerId: 'traveler1',
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        updatedAt: new Date('2099-01-01T02:00:00.000Z'),
        ledgerEntries: [
          {
            type: LedgerEntryType.ESCROW_CREDIT,
            amount: 1000,
          },
        ],
        payout: null,
        refund: {
          id: 'rf1',
          status: RefundStatus.REFUNDED,
          amount: 400,
          currency: 'XAF',
          refundedAt: new Date('2099-01-01T03:00:00.000Z'),
        },
      },
    ]);

    const result = await service.listMismatches();

    expect(result.items[0].mismatchSignals).toContain(
      'REFUNDED_REFUND_WITHOUT_MATCHING_REFUND_LEDGER',
    );
    expect(result.items[0].recommendedAction).toBe(
      'REVIEW_PAYOUT_REFUND_LEDGER_LINK',
    );
  });

  it('supports includeOk pagination and search', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-ok',
        status: TransactionStatus.DELIVERED,
        paymentStatus: PaymentStatus.SUCCESS,
        amount: 1000,
        commission: 100,
        escrowAmount: 1000,
        currency: 'XAF',
        senderId: 'sender-ok',
        travelerId: 'traveler-ok',
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        updatedAt: new Date('2099-01-01T01:00:00.000Z'),
        ledgerEntries: [
          {
            type: LedgerEntryType.ESCROW_CREDIT,
            amount: 1000,
          },
        ],
        payout: null,
        refund: null,
      },
      {
        id: 'tx-breach',
        status: TransactionStatus.PAID,
        paymentStatus: PaymentStatus.SUCCESS,
        amount: 2000,
        commission: 100,
        escrowAmount: 2000,
        currency: 'XAF',
        senderId: 'sender-breach',
        travelerId: 'traveler-breach',
        createdAt: new Date('2099-01-02T00:00:00.000Z'),
        updatedAt: new Date('2099-01-02T01:00:00.000Z'),
        ledgerEntries: [],
        payout: null,
        refund: null,
      },
    ]);

    const result = await service.listMismatches({
      includeOk: true,
      q: 'sender-ok',
      limit: 1,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].transactionId).toBe('tx-ok');
    expect(result.items[0].integrityStatus).toBe(LedgerIntegrityStatus.OK);
  });
});