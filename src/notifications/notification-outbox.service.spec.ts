import { Test, TestingModule } from '@nestjs/testing';
import { NotificationOutboxService } from './notification-outbox.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationOutboxService', () => {
  let service: NotificationOutboxService;
  let prisma: any;

  const mockPayload = {
    eventType: 'TRANSACTION_CREATED' as const,
    entityId: 'tx_001',
    recipientId: 'u1',
    data: { transactionId: 'tx_001' },
  };

  beforeEach(async () => {
    process.env.NOTIFICATIONS_ENABLED = 'true';

    prisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationOutboxService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationOutboxService>(NotificationOutboxService);
  });

  afterEach(() => {
    delete process.env.NOTIFICATIONS_ENABLED;
  });

  describe('enqueue', () => {
    it('queues a new notification when idempotency key is new', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.enqueue(mockPayload);

      expect(result.queued).toBe(true);
      expect(result.skipped).toBe(false);
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('skips when idempotency key already exists', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'existing' }]);

      const result = await service.enqueue(mockPayload);

      expect(result.queued).toBe(false);
      expect(result.skipped).toBe(true);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('skips when NOTIFICATIONS_ENABLED is false', async () => {
      process.env.NOTIFICATIONS_ENABLED = 'false';
      const module = await Test.createTestingModule({
        providers: [
          NotificationOutboxService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      const disabledService =
        module.get<NotificationOutboxService>(NotificationOutboxService);

      const result = await disabledService.enqueue(mockPayload);

      expect(result.skipped).toBe(true);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('idempotency key format is notification:{eventType}:{entityId}', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.enqueue(mockPayload);

      const queryCall = prisma.$queryRaw.mock.calls[0];
      const callArgs = JSON.stringify(queryCall);
      expect(callArgs).toContain('notification:TRANSACTION_CREATED:tx_001');
    });
  });

  describe('processPendingBatch', () => {
    it('processes pending notifications and marks them SENT', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'n1',
          event_type: 'TRANSACTION_CREATED',
          recipient_user_id: 'u1',
          payload: { message: 'Test' },
          attempt_count: 0,
        },
      ]);

      const result = await service.processPendingBatch();

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('returns zero when no pending notifications', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.processPendingBatch();

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('handles processing error and increments failure count', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'n1',
          event_type: 'PAYOUT_PAID',
          recipient_user_id: 'u2',
          payload: { message: 'Test' },
          attempt_count: 0,
        },
      ]);
      prisma.$executeRaw
        .mockResolvedValueOnce(1)
        .mockRejectedValueOnce(new Error('DB error'));

      const result = await service.processPendingBatch();

      expect(result.failed).toBe(1);
    });

    it('skips processing when NOTIFICATIONS_ENABLED is false', async () => {
      process.env.NOTIFICATIONS_ENABLED = 'false';
      const module = await Test.createTestingModule({
        providers: [
          NotificationOutboxService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      const disabledService =
        module.get<NotificationOutboxService>(NotificationOutboxService);

      const result = await disabledService.processPendingBatch();

      expect(result.processed).toBe(0);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('renderNotificationText (via templates)', () => {
    it('generates correct text for TRANSACTION_CREATED', () => {
      const { renderNotificationText } = require('./notification-templates');
      const text = renderNotificationText('TRANSACTION_CREATED', {
        transactionId: 'tx_1',
      });
      expect(text).toContain('tx_1');
      expect(text.length).toBeGreaterThan(10);
    });

    it('returns fallback text for unknown event type', () => {
      const { renderNotificationText } = require('./notification-templates');
      const text = renderNotificationText('UNKNOWN_EVENT', {});
      expect(text).toContain('Valises');
    });
  });
});
