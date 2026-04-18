import { Test, TestingModule } from '@nestjs/testing';
import { ProviderEventObjectType } from '@prisma/client';
import { ProviderWebhookController } from './provider-webhook.controller';
import { PayoutService } from '../payout/payout.service';
import { RefundService } from '../refund/refund.service';

describe('ProviderWebhookController', () => {
  let controller: ProviderWebhookController;

  const payoutServiceMock = {
    ingestProviderEvent: jest.fn(),
  };

  const refundServiceMock = {
    ingestProviderEvent: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProviderWebhookController],
      providers: [
        { provide: PayoutService, useValue: payoutServiceMock },
        { provide: RefundService, useValue: refundServiceMock },
      ],
    }).compile();

    controller = module.get<ProviderWebhookController>(ProviderWebhookController);
  });

  it('routes payout webhook events to payout service ingestion', async () => {
    payoutServiceMock.ingestProviderEvent.mockResolvedValue({
      appliedAction: 'MARKED_PROCESSING',
    });

    const result = await controller.ingestEvent(
      {
        provider: 'MOCK_STRIPE',
        objectType: ProviderEventObjectType.PAYOUT,
        eventType: 'payout.processing',
        idempotencyKey: 'evt-1',
        payoutId: '11111111-1111-1111-1111-111111111111',
        payload: { providerStatus: 'processing' },
      },
      'sig-1',
      'delivery-1',
      '1713436800',
    );

    expect(payoutServiceMock.ingestProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'MOCK_STRIPE',
        eventType: 'payout.processing',
        idempotencyKey: 'evt-1',
        payoutId: '11111111-1111-1111-1111-111111111111',
        actorUserId: null,
        payload: expect.objectContaining({
          providerStatus: 'processing',
          _webhook: expect.objectContaining({
            signature: 'sig-1',
            deliveryId: 'delivery-1',
            providerTimestamp: '1713436800',
            signatureVerificationStatus: 'NOT_IMPLEMENTED_YET',
          }),
        }),
      }),
    );

    expect(result).toEqual({
      appliedAction: 'MARKED_PROCESSING',
    });
  });

  it('routes refund webhook events to refund service ingestion', async () => {
    refundServiceMock.ingestProviderEvent.mockResolvedValue({
      appliedAction: 'MARKED_REFUNDED',
    });

    const result = await controller.ingestEvent(
      {
        provider: 'MANUAL',
        objectType: ProviderEventObjectType.REFUND,
        eventType: 'refund.refunded',
        idempotencyKey: 'evt-2',
        refundId: '22222222-2222-2222-2222-222222222222',
        payload: { providerStatus: 'refunded' },
      },
      undefined,
      undefined,
      undefined,
    );

    expect(refundServiceMock.ingestProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'MANUAL',
        eventType: 'refund.refunded',
        idempotencyKey: 'evt-2',
        refundId: '22222222-2222-2222-2222-222222222222',
        actorUserId: null,
        payload: expect.objectContaining({
          providerStatus: 'refunded',
          _webhook: expect.objectContaining({
            signature: null,
            deliveryId: null,
            providerTimestamp: null,
            signatureVerificationStatus: 'NOT_IMPLEMENTED_YET',
          }),
        }),
      }),
    );

    expect(result).toEqual({
      appliedAction: 'MARKED_REFUNDED',
    });
  });
});