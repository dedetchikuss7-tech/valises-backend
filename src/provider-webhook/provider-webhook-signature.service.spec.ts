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

  // ─── CinetPay signature tests ─────────────────────────────────────────────

  it('verifies a valid CINETPAY signature with correct rawBody', () => {
    process.env.PROVIDER_WEBHOOK_SECRET_CINETPAY = 'cinetpay_secret';
    const rawBody = '{"provider":"CINETPAY","eventType":"payment.success"}';
    const signature = service.buildCinetPaySignature('cinetpay_secret', rawBody);

    const result = service.verify(
      {
        provider: 'CINETPAY',
        objectType: ProviderEventObjectType.PAYMENT,
        eventType: 'payment.success',
        idempotencyKey: 'evt-cp-1',
        payload: {},
      },
      { signature, rawBody },
    );

    expect(result).toEqual({
      status: 'VERIFIED',
      provider: 'CINETPAY',
      secretConfigured: true,
    });
  });

  it('rejects CINETPAY signature when rawBody has been altered', () => {
    process.env.PROVIDER_WEBHOOK_SECRET_CINETPAY = 'cinetpay_secret';
    const originalRawBody = '{"provider":"CINETPAY","eventType":"payment.success"}';
    const signature = service.buildCinetPaySignature('cinetpay_secret', originalRawBody);
    const alteredRawBody = '{"provider":"CINETPAY","eventType":"payment.success","injected":true}';

    const result = service.verify(
      {
        provider: 'CINETPAY',
        objectType: ProviderEventObjectType.PAYMENT,
        eventType: 'payment.success',
        idempotencyKey: 'evt-cp-2',
        payload: {},
      },
      { signature, rawBody: alteredRawBody },
    );

    expect(result).toEqual({
      status: 'FAILED_INVALID_SIGNATURE',
      provider: 'CINETPAY',
      secretConfigured: true,
    });
  });

  it('bypasses CINETPAY verification when PROVIDER_WEBHOOK_SECRET_CINETPAY is absent', () => {
    delete process.env.PROVIDER_WEBHOOK_SECRET_CINETPAY;

    const result = service.verify(
      {
        provider: 'CINETPAY',
        objectType: ProviderEventObjectType.PAYMENT,
        eventType: 'payment.success',
        idempotencyKey: 'evt-cp-3',
        payload: {},
      },
      { signature: 'any', rawBody: '{}' },
    );

    expect(result).toEqual({
      status: 'BYPASSED_NO_SECRET',
      provider: 'CINETPAY',
      secretConfigured: false,
    });
  });

  it('returns BYPASSED_NO_RAW_BODY for CINETPAY when rawBody is absent (non-blocking)', () => {
    process.env.PROVIDER_WEBHOOK_SECRET_CINETPAY = 'cinetpay_secret';

    const result = service.verify(
      {
        provider: 'CINETPAY',
        objectType: ProviderEventObjectType.PAYMENT,
        eventType: 'payment.success',
        idempotencyKey: 'evt-cp-4',
        payload: {},
      },
      { signature: 'any' },
    );

    expect(result).toEqual({
      status: 'BYPASSED_NO_RAW_BODY',
      provider: 'CINETPAY',
      secretConfigured: true,
    });
  });

  // ─── verifyTimestamp tests ────────────────────────────────────────────────

  it('verifyTimestamp: timestamp within window → valid', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const result = service.verifyTimestamp(String(nowSeconds - 60), 300);
    expect(result).toEqual({ valid: true, reason: null });
  });

  it('verifyTimestamp: timestamp too old → invalid', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const result = service.verifyTimestamp(String(nowSeconds - 400), 300);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/TIMESTAMP_TOO_OLD/);
  });

  it('verifyTimestamp: absent timestamp → valid (permissive)', () => {
    expect(service.verifyTimestamp(undefined, 300)).toEqual({ valid: true, reason: null });
    expect(service.verifyTimestamp(null, 300)).toEqual({ valid: true, reason: null });
    expect(service.verifyTimestamp('', 300)).toEqual({ valid: true, reason: null });
  });

  it('verifyTimestamp: non-numeric timestamp → invalid', () => {
    const result = service.verifyTimestamp('not-a-number', 300);
    expect(result).toEqual({ valid: false, reason: 'INVALID_TIMESTAMP_FORMAT' });
  });

  it('verifyTimestamp: millisecond timestamp is converted and validated correctly', () => {
    const nowMs = Date.now();
    const recentMs = nowMs - 30_000; // 30 seconds ago in ms
    const result = service.verifyTimestamp(String(recentMs), 300);
    expect(result).toEqual({ valid: true, reason: null });
  });
});