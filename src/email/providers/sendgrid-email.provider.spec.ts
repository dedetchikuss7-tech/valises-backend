import { ConfigService } from '@nestjs/config';
import { SendGridEmailProvider } from './sendgrid-email.provider';

describe('SendGridEmailProvider', () => {
  const mockConfig = (overrides: Record<string, string> = {}) => ({
    get: jest.fn().mockImplementation((key: string) => {
      const defaults: Record<string, string> = {
        SENDGRID_API_KEY: 'SG.test-key',
        EMAIL_FROM_ADDRESS: 'noreply@valises.app',
        EMAIL_FROM_NAME: 'Valises',
        ...overrides,
      };
      return defaults[key] ?? undefined;
    }),
  });

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('sends email successfully when fetch returns 202', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 202,
    });

    const provider = new SendGridEmailProvider(mockConfig() as any as ConfigService);
    await expect(
      provider.sendEmail({
        to: 'user@example.com',
        subject: 'Hello',
        htmlBody: '<p>Test</p>',
        textBody: 'Test',
      }),
    ).resolves.toBeUndefined();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.sendgrid.com/v3/mail/send',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws when SendGrid returns a non-ok status', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValue('Bad request'),
    });

    const provider = new SendGridEmailProvider(mockConfig() as any as ConfigService);
    await expect(
      provider.sendEmail({
        to: 'user@example.com',
        subject: 'Hello',
        htmlBody: '<p>Test</p>',
      }),
    ).rejects.toThrow('SendGrid delivery failed: 400');
  });

  it('includes List-Unsubscribe header when unsubscribeToken is provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 202 });

    const provider = new SendGridEmailProvider(mockConfig() as any as ConfigService);
    await provider.sendEmail({
      to: 'user@example.com',
      subject: 'Hello',
      htmlBody: '<p>Test</p>',
      unsubscribeToken: 'tok-xyz',
    });

    const bodyArg = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(bodyArg.headers['List-Unsubscribe']).toContain('tok-xyz');
  });

  it('omits List-Unsubscribe header when no token provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 202 });

    const provider = new SendGridEmailProvider(mockConfig() as any as ConfigService);
    await provider.sendEmail({
      to: 'user@example.com',
      subject: 'Hello',
      htmlBody: '<p>Test</p>',
    });

    const bodyArg = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(bodyArg.headers).toBeUndefined();
  });
});
