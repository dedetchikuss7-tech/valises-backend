import { Test, TestingModule } from '@nestjs/testing';
import { PushNotificationService } from './push-notification.service';
import { PUSH_PROVIDER_TOKEN } from './push.interface';
import { PushTemplatesService } from './push-templates.service';
import { DeviceTokenService } from './device-token.service';

const mockPushProvider = { sendPush: jest.fn() };
const mockPushTemplates = { render: jest.fn() };
const mockDeviceTokenService = {
  getTokensForUser: jest.fn(),
  removeInvalidToken: jest.fn(),
};

describe('PushNotificationService', () => {
  let service: PushNotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationService,
        { provide: PUSH_PROVIDER_TOKEN, useValue: mockPushProvider },
        { provide: PushTemplatesService, useValue: mockPushTemplates },
        { provide: DeviceTokenService, useValue: mockDeviceTokenService },
      ],
    }).compile();

    service = module.get<PushNotificationService>(PushNotificationService);
    jest.clearAllMocks();
  });

  it('sends push to all user tokens', async () => {
    mockDeviceTokenService.getTokensForUser.mockResolvedValue([
      { id: 't1', token: 'token-abc', platform: 'IOS' },
      { id: 't2', token: 'token-xyz', platform: 'ANDROID' },
    ]);
    mockPushTemplates.render.mockReturnValue({ title: 'Test', body: 'Message' });
    mockPushProvider.sendPush.mockResolvedValue({ success: true });

    await service.sendToUser('u1', 'payment_confirmed', { transactionId: 'tx123' });

    expect(mockPushProvider.sendPush).toHaveBeenCalledTimes(2);
  });

  it('skips silently when user has no tokens', async () => {
    mockDeviceTokenService.getTokensForUser.mockResolvedValue([]);
    await service.sendToUser('u1', 'payment_confirmed', {});
    expect(mockPushProvider.sendPush).not.toHaveBeenCalled();
  });

  it('removes unregistered token on FCM NotRegistered error', async () => {
    mockDeviceTokenService.getTokensForUser.mockResolvedValue([
      { id: 't1', token: 'bad-token', platform: 'IOS' },
    ]);
    mockPushTemplates.render.mockReturnValue({ title: 'T', body: 'B' });
    mockPushProvider.sendPush.mockResolvedValue({ success: false, unregistered: true });

    await service.sendToUser('u1', 'delivery_confirmed', {});

    expect(mockDeviceTokenService.removeInvalidToken).toHaveBeenCalledWith('bad-token');
  });

  it('does not throw when push fails non-fatally', async () => {
    mockDeviceTokenService.getTokensForUser.mockResolvedValue([
      { id: 't1', token: 'token-fail', platform: 'ANDROID' },
    ]);
    mockPushTemplates.render.mockReturnValue({ title: 'T', body: 'B' });
    mockPushProvider.sendPush.mockResolvedValue({ success: false, error: 'Network timeout' });

    await expect(
      service.sendToUser('u1', 'dispute_opened', {}),
    ).resolves.not.toThrow();
  });
});

describe('PushTemplatesService', () => {
  let templates: PushTemplatesService;

  beforeEach(() => {
    templates = new PushTemplatesService();
  });

  it('renders transaction_created template', () => {
    const t = templates.render('transaction_created', { transactionId: 'abc123456' });
    expect(t.title).toBe('Demande créée');
    expect(t.body).toContain('#123456');
  });

  it('renders payment_confirmed template', () => {
    const t = templates.render('payment_confirmed', { transactionId: 'abc123456' });
    expect(t.title).toBe('Paiement confirmé');
    expect(t.body).toContain('#123456');
  });

  it('renders delivery_confirmed template', () => {
    const t = templates.render('delivery_confirmed', { transactionId: 'abc123456' });
    expect(t.title).toBe('Livraison confirmée ✓');
    expect(t.body).toContain('#123456');
  });

  it('renders dispute_opened template', () => {
    const t = templates.render('dispute_opened', { transactionId: 'abc123456' });
    expect(t.title).toBe('Litige ouvert');
    expect(t.body).toContain('72h');
  });

  it('renders payout_paid with amount', () => {
    const t = templates.render('payout_paid', { amountXaf: 500000 });
    expect(t.title).toBe('Virement effectué');
    expect(t.body).toContain('5');
  });

  it('renders payout_paid without amount', () => {
    const t = templates.render('payout_paid', {});
    expect(t.title).toBe('Virement effectué');
    expect(t.body).toBe('Votre virement a été traité.');
  });

  it('returns default template for unknown key', () => {
    const t = templates.render('unknown_event', { message: 'Hello' });
    expect(t.title).toBe('Valises');
    expect(t.body).toBe('Hello');
  });

  it('returns default template with fallback body when no message', () => {
    const t = templates.render('unknown_event', {});
    expect(t.title).toBe('Valises');
    expect(t.body).toBe('Vous avez une nouvelle notification.');
  });
});
