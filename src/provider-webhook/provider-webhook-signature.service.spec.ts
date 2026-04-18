import { ProviderEventObjectType } from '@prisma/client';
import { ProviderWebhookSignatureService } from './provider-webhook-signature.service';

describe('ProviderWebhookSignatureService', () => {
  let service: ProviderWebhookSignatureService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    service = new ProviderWebhookSignatureService();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('bypasses verification when no secret is configured for MOCK_STRIPE', () => {
    delete process.env.PROVIDER_WEBHOOK_SECRET_MOCK_STRIPE;
    delete process.env.MOCK_STRIPE_WEBHOOK_SECRET;

    const result = service.verify(
      {
        provider: 'MOCK_STRIPE',
        objectType: ProviderEventObjectType.PAYOUT,
        eventType: 'payout.processing',
        idempotencyKey: 'evt-1',
        payload: {},
      },
      {},
    );

    expect(result).toEqual({
      status: 'BYPASSED_NO_SECRET',
      provider: 'MOCK_STRIPE',
      secretConfigured: false,
    });
  });

  it('fails when secret is configured but signature is missing', () => {
    process.env.PROVIDER_WEBHOOK_SECRET_MOCK_STRIPE = 'top_secret';

    const result = service.verify(
      {
        provider: 'MOCK_STRIPE',
        objectType: ProviderEventObjectType.PAYOUT,
        eventType: 'payout.processing',
        idempotencyKey: 'evt-2',
        payload: {},
      },
      {},
    );

    expect(result).toEqual({
      status: 'FAILED_MISSING_SIGNATURE',
      provider: 'MOCK_STRIPE',
      secretConfigured: true,
    });
  });

  it('verifies a valid MOCK_STRIPE signature', () => {
    process.env.PROVIDER_WEBHOOK_SECRET_MOCK_STRIPE = 'top_secret';

    const dto = {
      provider: 'MOCK_STRIPE',
      objectType: ProviderEventObjectType.PAYOUT,
      eventType: 'payout.processing',
      idempotencyKey: 'evt-3',
      payoutId: '11111111-1111-1111-1111-111111111111',
      payload: { providerStatus: 'processing' },
    };

    const signature = service.buildSignature(
      'top_secret',
      JSON.stringify({
        eventType: 'payout.processing',
        externalReference: null,
        idempotencyKey: 'evt-3',
        objectType: ProviderEventObjectType.PAYOUT,
        occurredAt: null,
        payload: { providerStatus: 'processing' },
        payoutId: '11111111-1111-1111-1111-111111111111',
        provider: 'MOCK_STRIPE',
        refundId: null,
        transactionId: null,
      }),
    );

    const result = service.verify(dto as any, {
      signature,
    });

    expect(result).toEqual({
      status: 'VERIFIED',
      provider: 'MOCK_STRIPE',
      secretConfigured: true,
    });
  });

  it('marks unsupported providers as not supported', () => {
    const result = service.verify(
      {
        provider: 'MANUAL',
        objectType: ProviderEventObjectType.REFUND,
        eventType: 'refund.refunded',
        idempotencyKey: 'evt-4',
        payload: {},
      },
      {},
    );

    expect(result).toEqual({
      status: 'NOT_SUPPORTED_PROVIDER',
      provider: 'MANUAL',
      secretConfigured: false,
    });
  });
});