import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { ProviderEventObjectType } from '@prisma/client';
import { IngestProviderWebhookEventDto } from '../provider-webhook/dto/ingest-provider-webhook-event.dto';
import { NOTIFICATION_QUEUE, WEBHOOK_QUEUE } from './queue.module';
import { QueueService } from './queue.service';
import { NOTIFICATION_JOB_PROCESS } from './workers/notification.worker';
import { WEBHOOK_JOB_PROCESS } from './workers/webhook.worker';

const makeWebhookQueueMock = () => ({
  add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
});

const makeNotificationQueueMock = () => ({
  add: jest.fn().mockResolvedValue({ id: 'notif-job-id' }),
});

describe('QueueService', () => {
  let service: QueueService;
  let webhookQueueMock: ReturnType<typeof makeWebhookQueueMock>;
  let notificationQueueMock: ReturnType<typeof makeNotificationQueueMock>;

  beforeEach(async () => {
    webhookQueueMock = makeWebhookQueueMock();
    notificationQueueMock = makeNotificationQueueMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: getQueueToken(WEBHOOK_QUEUE), useValue: webhookQueueMock },
        { provide: getQueueToken(NOTIFICATION_QUEUE), useValue: notificationQueueMock },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  describe('enqueueWebhook()', () => {
    const dto: IngestProviderWebhookEventDto = {
      provider: 'MOCK_STRIPE',
      objectType: ProviderEventObjectType.PAYOUT,
      eventType: 'payout.paid',
      idempotencyKey: 'test-idempotency-key-abc123',
      payoutId: 'payout-uuid-1',
    };
    const headers = { signature: 'sig', deliveryId: 'del', providerTimestamp: '123', rawBody: null };

    it('calls webhookQueue.add with correct job name and data', async () => {
      await service.enqueueWebhook(dto, headers);

      expect(webhookQueueMock.add).toHaveBeenCalledWith(
        WEBHOOK_JOB_PROCESS,
        { dto, headers },
        expect.objectContaining({ jobId: `webhook:${dto.idempotencyKey}` }),
      );
    });

    it('uses idempotencyKey in deduplication option', async () => {
      await service.enqueueWebhook(dto, headers);

      const callArgs = webhookQueueMock.add.mock.calls[0];
      expect(callArgs[2]).toMatchObject({
        deduplication: { id: dto.idempotencyKey },
      });
    });

    it('returns the jobId from the created job', async () => {
      const result = await service.enqueueWebhook(dto, headers);
      expect(result).toEqual({ jobId: 'test-job-id' });
    });
  });

  describe('enqueueNotificationOutbox()', () => {
    it('calls notificationQueue.add with correct job name and default limit', async () => {
      await service.enqueueNotificationOutbox();

      expect(notificationQueueMock.add).toHaveBeenCalledWith(
        NOTIFICATION_JOB_PROCESS,
        { limit: 25 },
        expect.objectContaining({ jobId: expect.stringMatching(/^notification-outbox:\d+$/) }),
      );
    });

    it('passes custom limit when provided', async () => {
      await service.enqueueNotificationOutbox(50);

      expect(notificationQueueMock.add).toHaveBeenCalledWith(
        NOTIFICATION_JOB_PROCESS,
        { limit: 50 },
        expect.any(Object),
      );
    });

    it('returns the jobId from the created job', async () => {
      const result = await service.enqueueNotificationOutbox();
      expect(result).toEqual({ jobId: 'notif-job-id' });
    });
  });
});
