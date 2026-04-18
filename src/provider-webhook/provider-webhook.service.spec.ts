import { UnauthorizedException } from '@nestjs/common';
import { ProviderEventObjectType } from '@prisma/client';
import { ProviderWebhookService } from './provider-webhook.service';
import { ProviderWebhookSignatureService } from './provider-webhook-signature.service';

describe('ProviderWebhookService', () => {
  let service: ProviderWebhookService;

  const payoutServiceMock = {
    ingestProviderEvent: jest.fn(),
  };

  const refundServiceMock = {
    ingestProviderEvent: jest.fn(),
  };

  const signatureServiceMock = {
    verify: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new ProviderWebhookService(
      payoutServiceMock as any,
      refundServiceMock as any,
      signatureServiceMock as unknown as ProviderWebhookSignatureService,
    );
  });

  it('routes normalized payout webhook events to payout service', async () => {
    signatureServiceMock.verify.mockReturnValue({
      status: 'BYPASSED_NO_SECRET',
      provider: 'MOCK_STRIPE',
      secretConfigured: false,
    });

    payoutServiceMock.ingestProviderEvent.mockResolvedValue({
      appliedAction: 'MARKED_PAID',
    });

    const result = await service.handleIncomingEvent(
      {
        provider: 'mock_stripe',
        objectType: ProviderEventObjectType.PAYOUT,
        eventType: 'payout.succeeded',
        idempotencyKey: 'evt-1',
        payoutId: '11111111-1111-1111-1111-111111111111',
        payload: { providerStatus: 'paid' },
      },
      {
        signature: null as any,
        deliveryId: 'delivery-1',
        providerTimestamp: '1713436800',
      },
    );

    expect(payoutServiceMock.ingestProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'MOCK_STRIPE',
        eventType: 'payout.paid',
        payoutId: '11111111-1111-1111-1111-111111111111',
      }),
    );

    expect(result).toEqual({
      appliedAction: 'MARKED_PAID',
    });
  });

  it('routes normalized refund webhook events to refund service', async () => {
    signatureServiceMock.verify.mockReturnValue({
      status: 'NOT_SUPPORTED_PROVIDER',
      provider: 'MANUAL',
      secretConfigured: false,
    });

    refundServiceMock.ingestProviderEvent.mockResolvedValue({
      appliedAction: 'MARKED_REFUNDED',
    });

    const result = await service.handleIncomingEvent(
      {
        provider: 'manual',
        objectType: ProviderEventObjectType.REFUND,
        eventType: 'refund.refunded',
        idempotencyKey: 'evt-2',
        refundId: '22222222-2222-2222-2222-222222222222',
        payload: { providerStatus: 'refunded' },
      },
      {},
    );

    expect(refundServiceMock.ingestProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'MANUAL',
        eventType: 'refund.refunded',
        refundId: '22222222-2222-2222-2222-222222222222',
      }),
    );

    expect(result).toEqual({
      appliedAction: 'MARKED_REFUNDED',
    });
  });

  it('normalizes MOCK_STRIPE refund aliases before routing', async () => {
    signatureServiceMock.verify.mockReturnValue({
      status: 'BYPASSED_NO_SECRET',
      provider: 'MOCK_STRIPE',
      secretConfigured: false,
    });

    refundServiceMock.ingestProviderEvent.mockResolvedValue({
      appliedAction: 'MARKED_REFUNDED',
    });

    await service.handleIncomingEvent(
      {
        provider: 'mock_stripe',
        objectType: ProviderEventObjectType.REFUND,
        eventType: 'charge.refunded',
        idempotencyKey: 'evt-2b',
        refundId: '33333333-3333-3333-3333-333333333333',
        payload: { providerStatus: 'refunded' },
      },
      {},
    );

    expect(refundServiceMock.ingestProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'MOCK_STRIPE',
        eventType: 'refund.refunded',
        refundId: '33333333-3333-3333-3333-333333333333',
      }),
    );
  });

  it('rejects webhook ingestion when signature verification fails', async () => {
    signatureServiceMock.verify.mockReturnValue({
      status: 'FAILED_INVALID_SIGNATURE',
      provider: 'MOCK_STRIPE',
      secretConfigured: true,
    });

    await expect(
      service.handleIncomingEvent(
        {
          provider: 'mock_stripe',
          objectType: ProviderEventObjectType.PAYOUT,
          eventType: 'payout.processing',
          idempotencyKey: 'evt-3',
          payoutId: '33333333-3333-3333-3333-333333333333',
          payload: {},
        },
        {
          signature: 'bad-signature',
        },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});