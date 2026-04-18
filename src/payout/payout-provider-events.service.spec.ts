import { PayoutProvider, PayoutStatus, ProviderEventProcessingStatus } from '@prisma/client';
import { PayoutService } from './payout.service';

describe('PayoutService - provider event ingestion and reconciliation', () => {
  let service: PayoutService;

  const prismaMock = {
    transaction: {
      findUnique: jest.fn(),
    },
    corridor: {
      findUnique: jest.fn(),
    },
    corridorPricingPaymentConfig: {
      findUnique: jest.fn(),
    },
    payout: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refund: {
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
    getBalances: jest.fn(),
    addEntryIdempotent: jest.fn(),
  };

  const manualProviderMock = {
    provider: PayoutProvider.MANUAL,
    requestPayout: jest.fn(),
  };

  const mockStripeProviderMock = {
    provider: PayoutProvider.MOCK_STRIPE,
    requestPayout: jest.fn(),
  };

  const adminActionAuditMock = {
    recordSafe: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new PayoutService(
      prismaMock as any,
      ledgerMock as any,
      manualProviderMock as any,
      mockStripeProviderMock as any,
      adminActionAuditMock as any,
    );
  });

  it('ingests a processing provider event and updates the matched payout', async () => {
    prismaMock.providerEvent.findUnique.mockResolvedValue(null);

    prismaMock.payout.findUnique.mockResolvedValue({
      id: 'po1',
      transactionId: 'tx1',
      provider: PayoutProvider.MANUAL,
      railProvider: null,
      payoutMethodType: null,
      status: PayoutStatus.REQUESTED,
      amount: 1000,
      currency: 'XAF',
      idempotencyKey: 'payout_request:tx1',
      externalReference: null,
      failureReason: null,
      metadata: null,
      requestedAt: null,
      processedAt: null,
      paidAt: null,
    });

    prismaMock.providerEvent.create.mockResolvedValue({
      id: 'evt1',
      payoutId: 'po1',
      transactionId: 'tx1',
      processingStatus: ProviderEventProcessingStatus.RECEIVED,
    });

    prismaMock.payout.update.mockResolvedValue({
      id: 'po1',
      transactionId: 'tx1',
      status: PayoutStatus.PROCESSING,
      externalReference: 'manual_ref:po1',
    });

    prismaMock.providerEvent.update.mockResolvedValue({
      id: 'evt1',
      processingStatus: ProviderEventProcessingStatus.APPLIED,
    });

    const result = await service.ingestProviderEvent({
      provider: PayoutProvider.MANUAL,
      eventType: 'payout.processing',
      idempotencyKey: 'evt-key-1',
      payoutId: 'po1',
      externalReference: 'manual_ref:po1',
      payload: { providerStatus: 'processing' },
      actorUserId: 'admin1',
    });

    expect(prismaMock.payout.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'po1' },
        data: expect.objectContaining({
          status: PayoutStatus.PROCESSING,
          externalReference: 'manual_ref:po1',
        }),
      }),
    );

    expect(result.appliedAction).toBe('MARKED_PROCESSING');
    expect(result.providerEvent.processingStatus).toBe(
      ProviderEventProcessingStatus.APPLIED,
    );
  });

  it('ignores a provider event when no payout matches the provided identifiers', async () => {
    prismaMock.providerEvent.findUnique.mockResolvedValue(null);
    prismaMock.payout.findUnique.mockResolvedValue(null);
    prismaMock.payout.findFirst.mockResolvedValue(null);
    prismaMock.providerEvent.create.mockResolvedValue({
      id: 'evt2',
      processingStatus: ProviderEventProcessingStatus.RECEIVED,
    });
    prismaMock.providerEvent.update.mockResolvedValue({
      id: 'evt2',
      processingStatus: ProviderEventProcessingStatus.IGNORED,
      failureReason: 'No payout matched the provided identifiers',
    });

    const result = await service.ingestProviderEvent({
      provider: PayoutProvider.MANUAL,
      eventType: 'payout.requested',
      idempotencyKey: 'evt-key-2',
      externalReference: 'unknown-provider-ref',
      actorUserId: 'admin1',
    });

    expect(result.appliedAction).toBe('IGNORED_NO_MATCH');
    expect(result.payout).toBeNull();
    expect(result.providerEvent.processingStatus).toBe(
      ProviderEventProcessingStatus.IGNORED,
    );
  });

  it('returns a no-op reconciliation response when no provider event exists', async () => {
    prismaMock.payout.findUnique.mockResolvedValue({
      id: 'po3',
      transactionId: 'tx3',
      provider: PayoutProvider.MANUAL,
      railProvider: null,
      payoutMethodType: null,
      status: PayoutStatus.REQUESTED,
      amount: 1000,
      currency: 'XAF',
      idempotencyKey: 'payout_request:tx3',
      externalReference: null,
      failureReason: null,
      metadata: null,
      requestedAt: null,
      processedAt: null,
      paidAt: null,
    });

    prismaMock.providerEvent.findMany.mockResolvedValue([]);

    const result = await service.reconcileProviderEventsForTransaction(
      'tx3',
      'admin1',
    );

    expect(result).toEqual({
      transactionId: 'tx3',
      payoutId: 'po3',
      currentPayoutStatus: PayoutStatus.REQUESTED,
      reconciled: false,
      message: 'No provider events found for this payout',
    });
  });
});