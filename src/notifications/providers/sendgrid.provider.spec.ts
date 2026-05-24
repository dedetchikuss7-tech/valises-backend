import { SendGridProvider } from './sendgrid.provider';

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
}));

import * as sgMail from '@sendgrid/mail';

const mockSend = sgMail.send as jest.Mock;

describe('SendGridProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      SENDGRID_API_KEY: 'SG.test-key',
      SENDGRID_FROM_EMAIL: 'noreply@valises.app',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns success: true when sgMail.send() succeeds', async () => {
    mockSend.mockResolvedValueOnce([
      { headers: { 'x-message-id': 'msg-abc-123' }, statusCode: 202 },
      {},
    ]);

    const provider = new SendGridProvider();
    const result = await provider.sendEmail({
      recipientEmail: 'user@example.com',
      subject: 'Test subject',
      textContent: 'Hello',
      templateKey: 'SYSTEM',
    });

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBe('msg-abc-123');
    expect(result.sentAt).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('returns success: false without throwing when sgMail.send() throws', async () => {
    mockSend.mockRejectedValueOnce(new Error('SendGrid API unreachable'));

    const provider = new SendGridProvider();
    const result = await provider.sendEmail({
      recipientEmail: 'user@example.com',
      subject: 'Test',
      textContent: 'Hello',
      templateKey: 'SYSTEM',
    });

    expect(result.success).toBe(false);
    expect(result.providerMessageId).toBeNull();
    expect(result.error).toContain('SendGrid API unreachable');
  });

  it('throws at construction when SENDGRID_API_KEY is absent', () => {
    delete process.env.SENDGRID_API_KEY;

    expect(() => new SendGridProvider()).toThrow(
      'SendGridProvider: missing required env var SENDGRID_API_KEY',
    );
  });

  it('throws at construction when SENDGRID_FROM_EMAIL is absent', () => {
    delete process.env.SENDGRID_FROM_EMAIL;

    expect(() => new SendGridProvider()).toThrow(
      'SendGridProvider: missing required env var SENDGRID_FROM_EMAIL',
    );
  });
});
