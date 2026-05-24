import { createHmac } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { SmileIdProvider } from './smile-id.provider';

describe('SmileIdProvider', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMILE_ID_PARTNER_ID = 'partner-001';
    process.env.SMILE_ID_API_KEY = 'api-key-secret';
    process.env.SMILE_ID_CALLBACK_URL = 'https://api.valises.test/kyc/webhook';
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    delete process.env.SMILE_ID_PARTNER_ID;
    delete process.env.SMILE_ID_API_KEY;
    delete process.env.SMILE_ID_CALLBACK_URL;
  });

  it('createVerificationSession() calls Smile ID API and returns sessionId + sessionUrl', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        session_id: 'smid_session_001',
        url: 'https://hosted.smileidentity.com/session/smid_session_001',
      }),
    });

    const provider = new SmileIdProvider();
    const result = await provider.createVerificationSession({
      userId: 'user-1',
      email: 'user@test.com',
    });

    expect(result.sessionId).toBe('smid_session_001');
    expect(result.sessionUrl).toBe(
      'https://hosted.smileidentity.com/session/smid_session_001',
    );
    expect(result.status).toBe('pending');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/hosted_web/session'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('createVerificationSession() throws BadRequestException if SMILE_ID_PARTNER_ID absent', () => {
    delete process.env.SMILE_ID_PARTNER_ID;
    expect(() => new SmileIdProvider()).toThrow(
      'SmileIdProvider requires SMILE_ID_PARTNER_ID',
    );
  });

  it('retrieveSession() maps APPROVED → verified', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'APPROVED',
        url: null,
        failure_code: null,
        failure_reason: null,
      }),
    });

    const provider = new SmileIdProvider();
    const result = await provider.retrieveSession('smid_session_001');

    expect(result.status).toBe('verified');
    expect(result.rawStatus).toBe('APPROVED');
  });

  it('retrieveSession() maps REJECTED → rejected', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'REJECTED',
        url: null,
        failure_code: 'DOCUMENT_NOT_SUPPORTED',
        failure_reason: 'Document type not accepted',
      }),
    });

    const provider = new SmileIdProvider();
    const result = await provider.retrieveSession('smid_session_001');

    expect(result.status).toBe('rejected');
    expect(result.failureCode).toBe('DOCUMENT_NOT_SUPPORTED');
  });

  it('verifyWebhookSignature() correctly validates HMAC-SHA256', () => {
    const provider = new SmileIdProvider();
    const payload = JSON.stringify({ session_id: 'smid_001', status: 'APPROVED' });
    const signature = createHmac('sha256', 'api-key-secret')
      .update(payload)
      .digest('hex');

    const valid = provider.verifyWebhookSignature(payload, {
      'x-smile-id-signature': signature,
    });
    expect(valid).toBe(true);
  });

  it('verifyWebhookSignature() returns false if x-smile-id-signature header absent', () => {
    const provider = new SmileIdProvider();
    const valid = provider.verifyWebhookSignature('{}', {});
    expect(valid).toBe(false);
  });
});
