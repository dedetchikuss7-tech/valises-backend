import { Test, TestingModule } from '@nestjs/testing';
import { ProviderWebhookController } from './provider-webhook.controller';
import { ProviderWebhookService } from './provider-webhook.service';

describe('ProviderWebhookController', () => {
  let controller: ProviderWebhookController;

  const providerWebhookServiceMock = {
    handleIncomingEvent: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProviderWebhookController],
      providers: [
        {
          provide: ProviderWebhookService,
          useValue: providerWebhookServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ProviderWebhookController>(
      ProviderWebhookController,
    );
  });

  it('delegates webhook ingestion to the provider webhook service', async () => {
    providerWebhookServiceMock.handleIncomingEvent.mockResolvedValue({
      appliedAction: 'MARKED_PROCESSING',
    });

    const dto = {
      provider: 'MOCK_STRIPE',
      objectType: 'PAYOUT',
      eventType: 'payout.processing',
      idempotencyKey: 'evt-1',
      payoutId: '11111111-1111-1111-1111-111111111111',
      payload: { providerStatus: 'processing' },
    } as any;

    const result = await controller.ingestEvent(
      dto,
      'sig-1',
      'delivery-1',
      '1713436800',
    );

    expect(providerWebhookServiceMock.handleIncomingEvent).toHaveBeenCalledWith(
      dto,
      {
        signature: 'sig-1',
        deliveryId: 'delivery-1',
        providerTimestamp: '1713436800',
      },
    );

    expect(result).toEqual({
      appliedAction: 'MARKED_PROCESSING',
    });
  });
});