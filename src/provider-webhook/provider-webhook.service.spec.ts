import { BadRequestException, UnauthorizedException } from '@nestjs/common';
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
        idempotencyKey: 'evt-1',
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
        idempotencyKey: 'evt-2',
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

  it('normalizes generic success aliases for payout events', async () => {
    signatureServiceMock.verify.mockReturnValue({
      status: 'BYPASSED_NO_SECRET',
      provider: 'MOCK_STRIPE',
      secretConfigured: false,
    });

    payoutServiceMock.ingestProviderEvent.mockResolvedValue({
      appliedAction: 'MARKED_PAID',
    });

    await service.handleIncomingEvent(
      {
        provider: 'mock_stripe',
        objectType: ProviderEventObjectType.PAYOUT,
        eventType: 'success',
        idempotencyKey: 'evt-success',
        externalReference: 'provider-po-1',
        payload: {},
      },
      {},
    );

    expect(payoutServiceMock.ingestProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'MOCK_STRIPE',
        eventType: 'payout.paid',
        externalReference: 'provider-po-1',
      }),
    );
  });

  it('trims idempotency key and identifiers before routing', async () => {
    signatureServiceMock.verify.mockReturnValue({
      status: 'BYPASSED_NO_SECRET',
      provider: 'MOCK_STRIPE',
      secretConfigured: false,
    });

    payoutServiceMock.ingestProviderEvent.mockResolvedValue({
      appliedAction: 'MARKED_PROCESSING',
    });

    await service.handleIncomingEvent(
      {
        provider: ' mock_stripe ',
        objectType: ProviderEventObjectType.PAYOUT,
        eventType: ' processing ',
        idempotencyKey: ' evt-trimmed ',
        payoutId: '11111111-1111-1111-1111-111111111111',
        externalReference: ' provider-ref-1 ',
        payload: {},
      },
      {},
    );

    expect(payoutServiceMock.ingestProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'MOCK_STRIPE',
        eventType: 'payout.processing',
        idempotencyKey: 'evt-trimmed',
        payoutId: '11111111-1111-1111-1111-111111111111',
        externalReference: 'provider-ref-1',
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

  it('rejects payout webhook events carrying a refundId', async () => {
    await expect(
      service.handleIncomingEvent(
        {
          provider: 'MOCK_STRIPE',
          objectType: ProviderEventObjectType.PAYOUT,
          eventType: 'payout.processing',
          idempotencyKey: 'evt-invalid-1',
          refundId: '44444444-4444-4444-4444-444444444444',
          payload: {},
        },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(payoutServiceMock.ingestProviderEvent).not.toHaveBeenCalled();
  });

  it('rejects refund webhook events carrying a payoutId', async () => {
    await expect(
      service.handleIncomingEvent(
        {
          provider: 'MOCK_STRIPE',
          objectType: ProviderEventObjectType.REFUND,
          eventType: 'refund.processing',
          idempotencyKey: 'evt-invalid-2',
          payoutId: '55555555-5555-5555-5555-555555555555',
          payload: {},
        },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(refundServiceMock.ingestProviderEvent).not.toHaveBeenCalled();
  });

  it('rejects payout webhook events without any usable identifier', async () => {
    await expect(
      service.handleIncomingEvent(
        {
          provider: 'MOCK_STRIPE',
          objectType: ProviderEventObjectType.PAYOUT,
          eventType: 'payout.processing',
          idempotencyKey: 'evt-invalid-3',
          payload: {},
        },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(payoutServiceMock.ingestProviderEvent).not.toHaveBeenCalled();
  });

  it('rejects refund webhook events without any usable identifier', async () => {
    await expect(
      service.handleIncomingEvent(
        {
          provider: 'MOCK_STRIPE',
          objectType: ProviderEventObjectType.REFUND,
          eventType: 'refund.processing',
          idempotencyKey: 'evt-invalid-4',
          payload: {},
        },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(refundServiceMock.ingestProviderEvent).not.toHaveBeenCalled();
  });

  it('rejects blank idempotency keys before routing', async () => {
    await expect(
      service.handleIncomingEvent(
        {
          provider: 'MOCK_STRIPE',
          objectType: ProviderEventObjectType.PAYOUT,
          eventType: 'payout.processing',
          idempotencyKey: '   ',
          payoutId: '66666666-6666-6666-6666-666666666666',
          payload: {},
        },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(payoutServiceMock.ingestProviderEvent).not.toHaveBeenCalled();
  });

  it('rejects unsupported payout providers before routing', async () => {
    await expect(
      service.handleIncomingEvent(
        {
          provider: 'CINETPAY',
          objectType: ProviderEventObjectType.PAYOUT,
          eventType: 'payout.processing',
          idempotencyKey: 'evt-invalid-provider',
          payoutId: '77777777-7777-7777-7777-777777777777',
          payload: {},
        },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(payoutServiceMock.ingestProviderEvent).not.toHaveBeenCalled();
  });
});