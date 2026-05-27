import { MockEmailProvider } from './mock-email.provider';

describe('MockEmailProvider', () => {
  let provider: MockEmailProvider;

  beforeEach(() => {
    provider = new MockEmailProvider();
  });

  it('resolves without throwing', async () => {
    await expect(
      provider.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        htmlBody: '<p>Hello</p>',
        textBody: 'Hello',
        unsubscribeToken: 'tok-abc',
      }),
    ).resolves.toBeUndefined();
  });

  it('resolves when optional fields are absent', async () => {
    await expect(
      provider.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        htmlBody: '<p>Hello</p>',
      }),
    ).resolves.toBeUndefined();
  });
});
