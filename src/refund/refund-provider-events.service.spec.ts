import {
  PaymentStatus,
  RefundProvider,
  RefundStatus,
  ProviderEventProcessingStatus,
} from '@prisma/client';
import { RefundService } from './refund.service';

describe('RefundService - provider event ingestion and reconciliation', () => {
  let service: RefundService;

  const prismaMock = {
    transaction: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    refund: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    payout: {
      findMany: jest.fn(),
    },
    dispute: {
      findMany: jest.fn(),
    },
    providerEvent: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const ledgerMock = {
    getEscrowBalance: jest.fn(),
    getBalances: jest.fn(),
    addEntryIdempotent: jest.fn(),
  };

  const manualProviderMock = {
    provider: RefundProvider.MANUAL,
    requestRefund: jest.fn(),
  };

  const mockStripeProviderMock = {
    provider: RefundProvider.MOCK_STRIPE,
    requestRefund: jest.fn(),
  };

  const adminActionAuditMock = {
    recordSafe: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(async (cb: any) =>
      cb({
        refund: {
          update: prismaMock.refund.update,
        },
        transaction: {
          update: prismaMock.transaction.update,
        },
        ledgerEntry: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
        },
      }),
    );

    service = new RefundService(
      prismaMock as any,
      ledgerMock as any,
      manualProviderMock as any,
      mockStripeProviderMock as any,
      adminActionAuditMock as any,
    );
  });

  it('ingests a processing provider event and updates the matched refund', async () => {
    prismaMock.providerEvent.findUnique.mockResolvedValue(null);

    prismaMock.refund.findUnique.mockResolvedValue({
      id: 'rf1',
      transactionId: 'tx1',
      provider: RefundProvider.MANUAL,
      status: RefundStatus.REQUESTED,
      amount: 400,
      currency: 'XAF',
      idempotencyKey: 'refund_request:tx1',
      externalReference: null,
      failureReason: null,
      metadata: null,
      requestedAt: null,
      processedAt: null,
      refundedAt: null,
    });

    prismaMock.providerEvent.create.mockResolvedValue({
      id: 'evt1',
      refundId: 'rf1',
      transactionId: 'tx1',
      processingStatus: ProviderEventProcessingStatus.RECEIVED,
    });

    prismaMock.refund.update.mockResolvedValue({
      id: 'rf1',
      transactionId: 'tx1',
      status: RefundStatus.PROCESSING,
      externalReference: 'manual_refund:rf1',
    });

    prismaMock.providerEvent.update.mockResolvedValue({
      id: 'evt1',
      processingStatus: ProviderEventProcessingStatus.APPLIED,
    });

    const result = await service.ingestProviderEvent({
      provider: RefundProvider.MANUAL,
      eventType: 'refund.processing',
      idempotencyKey: 'evt-key-1',
      refundId: 'rf1',
      externalReference: 'manual_refund:rf1',
      payload: { providerStatus: 'processing' },
      actorUserId: 'admin1',
    });

    expect(prismaMock.refund.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rf1' },
        data: expect.objectContaining({
          status: RefundStatus.PROCESSING,
          externalReference: 'manual_refund:rf1',
        }),
      }),
    );

    expect(result.appliedAction).toBe('MARKED_PROCESSING');
    expect(result.providerEvent.processingStatus).toBe(
      ProviderEventProcessingStatus.APPLIED,
    );
  });

  it('ignores a provider event when no refund matches the provided identifiers', async () => {
    prismaMock.providerEvent.findUnique.mockResolvedValue(null);
    prismaMock.refund.findUnique.mockResolvedValue(null);
    prismaMock.refund.findFirst.mockResolvedValue(null);
    prismaMock.providerEvent.create.mockResolvedValue({
      id: 'evt2',
      processingStatus: ProviderEventProcessingStatus.RECEIVED,
    });
    prismaMock.providerEvent.update.mockResolvedValue({
      id: 'evt2',
      processingStatus: ProviderEventProcessingStatus.IGNORED,
      failureReason: 'No refund matched the provided identifiers',
    });

    const result = await service.ingestProviderEvent({
      provider: RefundProvider.MANUAL,
      eventType: 'refund.requested',
      idempotencyKey: 'evt-key-2',
      externalReference: 'unknown-provider-ref',
      actorUserId: 'admin1',
    });

    expect(result.appliedAction).toBe('IGNORED_NO_MATCH');
    expect(result.refund).toBeNull();
    expect(result.providerEvent.processingStatus).toBe(
      ProviderEventProcessingStatus.IGNORED,
    );
  });

  it('marks refund refunded when a refunded provider event is ingested', async () => {
    prismaMock.providerEvent.findUnique.mockResolvedValue(null);

    prismaMock.refund.findUnique.mockResolvedValue({
      id: 'rf3',
      transactionId: 'tx3',
      provider: RefundProvider.MANUAL,
      status: RefundStatus.REQUESTED,
      amount: 1000,
      currency: 'XAF',
      idempotencyKey: 'refund_request:tx3',
      externalReference: null,
      failureReason: null,
      metadata: null,
      requestedAt: null,
      processedAt: null,
      refundedAt: null,
      transaction: {
        id: 'tx3',
        amount: 1000,
        paymentStatus: PaymentStatus.SUCCESS,
      },
    });

    prismaMock.providerEvent.create.mockResolvedValue({
      id: 'evt3',
      refundId: 'rf3',
      transactionId: 'tx3',
      processingStatus: ProviderEventProcessingStatus.RECEIVED,
    });

    prismaMock.refund.update.mockResolvedValue({
      id: 'rf3',
      transactionId: 'tx3',
      status: RefundStatus.REFUNDED,
      amount: 1000,
      currency: 'XAF',
    });

    ledgerMock.addEntryIdempotent.mockResolvedValue({});
    ledgerMock.getBalances.mockResolvedValue({
      escrowBalance: 0,
      commissionBalance: 0,
      reserveBalance: 0,
      releasableAmount: 0,
    });

    prismaMock.transaction.update.mockResolvedValue({
      id: 'tx3',
      escrowAmount: 0,
      paymentStatus: PaymentStatus.REFUNDED,
    });

    prismaMock.providerEvent.update.mockResolvedValue({
      id: 'evt3',
      processingStatus: ProviderEventProcessingStatus.APPLIED,
    });

    const result = await service.ingestProviderEvent({
      provider: RefundProvider.MANUAL,
      eventType: 'refund.refunded',
      idempotencyKey: 'evt-key-3',
      refundId: 'rf3',
      externalReference: 'manual_refund:rf3',
      actorUserId: 'admin1',
    });

    expect(result.appliedAction).toBe('MARKED_REFUNDED');
    expect(ledgerMock.addEntryIdempotent).toHaveBeenCalled();
  });

  it('returns a no-op reconciliation response when no provider event exists', async () => {
    prismaMock.refund.findUnique.mockResolvedValue({
      id: 'rf4',
      transactionId: 'tx4',
      provider: RefundProvider.MANUAL,
      status: RefundStatus.REQUESTED,
      amount: 400,
      currency: 'XAF',
      idempotencyKey: 'refund_request:tx4',
      externalReference: null,
      failureReason: null,
      metadata: null,
      requestedAt: null,
      processedAt: null,
      refundedAt: null,
    });

    prismaMock.providerEvent.findMany.mockResolvedValue([]);

    const result = await service.reconcileProviderEventsForTransaction(
      'tx4',
      'admin1',
    );

    expect(result).toEqual({
      transactionId: 'tx4',
      refundId: 'rf4',
      currentRefundStatus: RefundStatus.REQUESTED,
      reconciled: false,
      message: 'No provider events found for this refund',
    });
  });
});