import { BadRequestException } from '@nestjs/common';
import { StripeIdentityProvider } from './stripe-identity.provider';

describe('StripeIdentityProvider', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it('createVerificationSession() returns sessionId and sessionUrl on success', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'vs_001',
        status: 'requires_input',
        url: 'https://verify.stripe.com/vs_001',
        last_error: null,
      }),
    });

    const provider = new StripeIdentityProvider();
    const result = await provider.createVerificationSession({
      userId: 'user-1',
      email: 'user@test.com',
    });

    expect(result.sessionId).toBe('vs_001');
    expect(result.sessionUrl).toBe('https://verify.stripe.com/vs_001');
    expect(result.status).toBe('pending');
    expect(result.rawStatus).toBe('requires_input');
  });

  it('createVerificationSession() throws BadRequestException if STRIPE_SECRET_KEY absent', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(() => new StripeIdentityProvider()).toThrow(
      'StripeIdentityProvider requires STRIPE_SECRET_KEY',
    );
  });

  it('retrieveSession() maps verified → status verified', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'vs_001',
        status: 'verified',
        url: null,
        last_error: null,
      }),
    });

    const provider = new StripeIdentityProvider();
    const result = await provider.retrieveSession('vs_001');

    expect(result.status).toBe('verified');
    expect(result.rawStatus).toBe('verified');
  });

  it('retrieveSession() maps requires_input → status rejected', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'vs_001',
        status: 'requires_input',
        url: 'https://verify.stripe.com/vs_001',
        last_error: { code: 'document_expired', reason: null },
      }),
    });

    const provider = new StripeIdentityProvider();
    const result = await provider.retrieveSession('vs_001');

    expect(result.status).toBe('rejected');
    expect(result.rawStatus).toBe('requires_input');
    expect(result.failureCode).toBe('document_expired');
  });

  it('verifyWebhookSignature() returns false if stripe-signature header absent', () => {
    const provider = new StripeIdentityProvider();
    const valid = provider.verifyWebhookSignature('{}', {});
    expect(valid).toBe(false);
  });

  it('verifyWebhookSignature() returns false if STRIPE_WEBHOOK_SECRET absent', () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const provider = new StripeIdentityProvider();
    const valid = provider.verifyWebhookSignature('{}', {
      'stripe-signature': 't=12345,v1=abc',
    });
    expect(valid).toBe(false);
  });
});
