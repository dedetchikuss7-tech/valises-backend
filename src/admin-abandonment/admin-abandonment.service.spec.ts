import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  AbandonmentKind,
  AbandonmentEventStatus,
  ReminderJobStatus,
} from '@prisma/client';
import { AdminAbandonmentService } from './admin-abandonment.service';

describe('AdminAbandonmentService', () => {
  let service: AdminAbandonmentService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      abandonmentEvent: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      reminderJob: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new AdminAbandonmentService(prisma);
  });

  it('should list abandonment events with default limit', async () => {
    prisma.abandonmentEvent.findMany.mockResolvedValue([
      {
        id: 'event1',
        userId: 'user1',
        kind: 'TRIP_DRAFT',
        status: 'ACTIVE',
        reminderJobs: [],
      },
    ]);

    const result = await service.listAbandonmentEvents({});

    expect(prisma.abandonmentEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.limit).toBe(50);
  });

  it('should apply abandonment event filters', async () => {
    prisma.abandonmentEvent.findMany.mockResolvedValue([]);

    await service.listAbandonmentEvents({
      userId: 'user1',
      kind: 'TRIP_DRAFT',
      status: 'ACTIVE',
      limit: 25,
    });

    expect(prisma.abandonmentEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user1',
          kind: 'TRIP_DRAFT',
          status: 'ACTIVE',
        },
        take: 25,
      }),
    );
  });

  it('should return one abandonment event by id', async () => {
    prisma.abandonmentEvent.findUnique.mockResolvedValue({
      id: 'event1',
      reminderJobs: [],
    });

    const result = await service.findAbandonmentEvent('event1');

    expect(result.id).toBe('event1');
  });

  it('should throw if abandonment event is not found', async () => {
    prisma.abandonmentEvent.findUnique.mockResolvedValue(null);

    await expect(service.findAbandonmentEvent('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should list reminder jobs with default limit', async () => {
    prisma.reminderJob.findMany.mockResolvedValue([
      {
        id: 'job1',
        status: 'PENDING',
        abandonmentEvent: { id: 'event1' },
      },
    ]);

    const result = await service.listReminderJobs({});

    expect(prisma.reminderJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.limit).toBe(50);
  });

  it('should apply reminder job filters', async () => {
    prisma.reminderJob.findMany.mockResolvedValue([]);

    await service.listReminderJobs({
      abandonmentEventId: 'event1',
      status: 'PENDING',
      channel: 'EMAIL',
      limit: 15,
    });

    expect(prisma.reminderJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          abandonmentEventId: 'event1',
          status: 'PENDING',
          channel: 'EMAIL',
        },
        take: 15,
      }),
    );
  });

  it('should list due reminder jobs', async () => {
    prisma.reminderJob.findMany.mockResolvedValue([
      {
        id: 'job1',
        status: ReminderJobStatus.PENDING,
        abandonmentEvent: {
          id: 'event1',
          status: AbandonmentEventStatus.ACTIVE,
        },
      },
    ]);

    const result = await service.listDueReminderJobs({ limit: 10 });

    expect(prisma.reminderJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ReminderJobStatus.PENDING,
          abandonmentEvent: {
            status: AbandonmentEventStatus.ACTIVE,
          },
        }),
        take: 10,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.filters.dueOnly).toBe(true);
  });

  it('should trigger due reminder jobs in batch', async () => {
    prisma.reminderJob.findMany.mockResolvedValue([
      {
        id: 'job1',
        abandonmentEventId: 'event1',
        status: ReminderJobStatus.PENDING,
        payload: { template: 'abandonment_reminder_30m' },
        abandonmentEvent: {
          id: 'event1',
          kind: AbandonmentKind.KYC_PENDING,
          status: AbandonmentEventStatus.ACTIVE,
        },
      },
      {
        id: 'job2',
        abandonmentEventId: 'event2',
        status: ReminderJobStatus.PENDING,
        payload: { template: 'abandonment_reminder_24h' },
        abandonmentEvent: {
          id: 'event2',
          kind: AbandonmentKind.PAYMENT_PENDING,
          status: AbandonmentEventStatus.ACTIVE,
        },
      },
    ]);

    prisma.reminderJob.update.mockResolvedValue({});

    const result = await service.triggerDueReminderJobs({ limit: 10 });

    expect(prisma.reminderJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ReminderJobStatus.PENDING,
          abandonmentEvent: {
            status: AbandonmentEventStatus.ACTIVE,
          },
        }),
        take: 10,
      }),
    );
    expect(prisma.reminderJob.update).toHaveBeenCalledTimes(2);
    expect(result.action).toBe('TRIGGERED_DUE_BATCH');
    expect(result.processedCount).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it('should return empty trigger due batch when no due reminder jobs exist', async () => {
    prisma.reminderJob.findMany.mockResolvedValue([]);

    const result = await service.triggerDueReminderJobs({ limit: 10 });

    expect(prisma.reminderJob.update).not.toHaveBeenCalled();
    expect(result.action).toBe('TRIGGERED_DUE_BATCH');
    expect(result.processedCount).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('should cancel due reminder jobs in batch', async () => {
    prisma.reminderJob.findMany.mockResolvedValue([
      {
        id: 'job1',
        abandonmentEventId: 'event1',
        status: ReminderJobStatus.PENDING,
        abandonmentEvent: {
          id: 'event1',
          kind: AbandonmentKind.KYC_PENDING,
          status: AbandonmentEventStatus.ACTIVE,
        },
      },
      {
        id: 'job2',
        abandonmentEventId: 'event2',
        status: ReminderJobStatus.PENDING,
        abandonmentEvent: {
          id: 'event2',
          kind: AbandonmentKind.PAYMENT_PENDING,
          status: AbandonmentEventStatus.ACTIVE,
        },
      },
    ]);

    prisma.reminderJob.update.mockResolvedValue({});

    const result = await service.cancelDueReminderJobs({ limit: 10 });

    expect(prisma.reminderJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ReminderJobStatus.PENDING,
          abandonmentEvent: {
            status: AbandonmentEventStatus.ACTIVE,
          },
        }),
        take: 10,
      }),
    );
    expect(prisma.reminderJob.update).toHaveBeenCalledTimes(2);
    expect(result.action).toBe('CANCELLED_DUE_BATCH');
    expect(result.processedCount).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it('should return empty cancel due batch when no due reminder jobs exist', async () => {
    prisma.reminderJob.findMany.mockResolvedValue([]);

    const result = await service.cancelDueReminderJobs({ limit: 10 });

    expect(prisma.reminderJob.update).not.toHaveBeenCalled();
    expect(result.action).toBe('CANCELLED_DUE_BATCH');
    expect(result.processedCount).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('should trigger reminder jobs in batch', async () => {
    prisma.reminderJob.findMany.mockResolvedValue([
      {
        id: 'job1',
        abandonmentEventId: 'event1',
        status: ReminderJobStatus.PENDING,
        payload: { template: 'abandonment_reminder_30m' },
        abandonmentEvent: {
          id: 'event1',
          kind: AbandonmentKind.KYC_PENDING,
          status: AbandonmentEventStatus.ACTIVE,
        },
      },
      {
        id: 'job2',
        abandonmentEventId: 'event1',
        status: ReminderJobStatus.PENDING,
        payload: { template: 'abandonment_reminder_24h' },
        abandonmentEvent: {
          id: 'event1',
          kind: AbandonmentKind.PAYMENT_PENDING,
          status: AbandonmentEventStatus.ACTIVE,
        },
      },
    ]);

    prisma.reminderJob.update.mockResolvedValue({});

    const result = await service.triggerReminderJobs({
      abandonmentEventId: 'event1',
      status: ReminderJobStatus.PENDING,
      limit: 10,
    });

    expect(prisma.reminderJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          abandonmentEventId: 'event1',
          status: ReminderJobStatus.PENDING,
          abandonmentEvent: {
            status: AbandonmentEventStatus.ACTIVE,
          },
        }),
        take: 10,
      }),
    );
    expect(prisma.reminderJob.update).toHaveBeenCalledTimes(2);
    expect(result.action).toBe('TRIGGERED_BATCH');
    expect(result.processedCount).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it('should ignore unsupported trigger batch status and fallback to PENDING', async () => {
    prisma.reminderJob.findMany.mockResolvedValue([]);

    const result = await service.triggerReminderJobs({
      status: ReminderJobStatus.FAILED,
      limit: 10,
    });

    expect(prisma.reminderJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ReminderJobStatus.PENDING,
        }),
      }),
    );
    expect(result.action).toBe('TRIGGERED_BATCH');
    expect(result.processedCount).toBe(0);
  });

  it('should return empty trigger batch when no pending reminder jobs exist', async () => {
    prisma.reminderJob.findMany.mockResolvedValue([]);

    const result = await service.triggerReminderJobs({ limit: 10 });

    expect(prisma.reminderJob.update).not.toHaveBeenCalled();
    expect(result.action).toBe('TRIGGERED_BATCH');
    expect(result.processedCount).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('should retry reminder jobs in batch with default statuses', async () => {
    prisma.reminderJob.findMany.mockResolvedValue([
      {
        id: 'job1',
        abandonmentEventId: 'event1',
        status: ReminderJobStatus.FAILED,
        abandonmentEvent: {
          id: 'event1',
          kind: AbandonmentKind.KYC_PENDING,
          status: AbandonmentEventStatus.ACTIVE,
        },
      },
      {
        id: 'job2',
        abandonmentEventId: 'event2',
        status: ReminderJobStatus.CANCELLED,
        abandonmentEvent: {
          id: 'event2',
          kind: AbandonmentKind.PAYMENT_PENDING,
          status: AbandonmentEventStatus.ACTIVE,
        },
      },
    ]);

    prisma.reminderJob.update.mockResolvedValue({});

    const result = await service.retryReminderJobs({ limit: 10 });

    expect(prisma.reminderJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [ReminderJobStatus.FAILED, ReminderJobStatus.CANCELLED],
          },
          abandonmentEvent: {
            status: AbandonmentEventStatus.ACTIVE,
          },
        }),
        take: 10,
      }),
    );
    expect(prisma.reminderJob.update).toHaveBeenCalledTimes(2);
    expect(result.action).toBe('RETRIED_BATCH');
    expect(result.processedCount).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it('should retry reminder jobs in batch with explicit FAILED status', async () => {
    prisma.reminderJob.findMany.mockResolvedValue([
      {
        id: 'job1',
        abandonmentEventId: 'event1',
        status: ReminderJobStatus.FAILED,
        abandonmentEvent: {
          id: 'event1',
          kind: AbandonmentKind.KYC_PENDING,
          status: AbandonmentEventStatus.ACTIVE,
        },
      },
    ]);

    prisma.reminderJob.update.mockResolvedValue({});

    const result = await service.retryReminderJobs({
      status: ReminderJobStatus.FAILED,
      limit: 5,
    });

    expect(prisma.reminderJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ReminderJobStatus.FAILED,
        }),
        take: 5,
      }),
    );
    expect(result.action).toBe('RETRIED_BATCH');
    expect(result.processedCount).toBe(1);
  });

  it('should ignore unsupported retry status and fallback to FAILED/CANCELLED', async () => {
    prisma.reminderJob.findMany.mockResolvedValue([]);

    const result = await service.retryReminderJobs({
      status: ReminderJobStatus.PENDING,
      limit: 10,
    });

    expect(prisma.reminderJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [ReminderJobStatus.FAILED, ReminderJobStatus.CANCELLED],
          },
        }),
      }),
    );
    expect(result.action).toBe('RETRIED_BATCH');
    expect(result.processedCount).toBe(0);
  });

  it('should return empty retry batch when no retryable reminder jobs exist', async () => {
    prisma.reminderJob.findMany.mockResolvedValue([]);

    const result = await service.retryReminderJobs({ limit: 10 });

    expect(prisma.reminderJob.update).not.toHaveBeenCalled();
    expect(result.action).toBe('RETRIED_BATCH');
    expect(result.processedCount).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('should trigger one reminder job manually', async () => {
    prisma.reminderJob.findUnique.mockResolvedValue({
      id: 'job1',
      status: ReminderJobStatus.PENDING,
      payload: { template: 'abandonment_reminder_30m' },
      abandonmentEvent: {
        id: 'event1',
        kind: AbandonmentKind.TRIP_DRAFT,
        status: AbandonmentEventStatus.ACTIVE,
      },
    });

    prisma.reminderJob.update.mockResolvedValue({
      id: 'job1',
      status: ReminderJobStatus.SENT,
      abandonmentEvent: {
        id: 'event1',
        kind: AbandonmentKind.TRIP_DRAFT,
        status: AbandonmentEventStatus.ACTIVE,
      },
    });

    const result = await service.triggerReminderJob('job1');

    expect(result.action).toBe('TRIGGERED');
    expect(prisma.reminderJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job1' },
        data: expect.objectContaining({
          status: ReminderJobStatus.SENT,
          attemptCount: { increment: 1 },
        }),
      }),
    );
  });

  it('should cancel one reminder job', async () => {
    prisma.reminderJob.findUnique.mockResolvedValue({
      id: 'job1',
      status: ReminderJobStatus.PENDING,
      abandonmentEvent: {
        id: 'event1',
        kind: AbandonmentKind.TRIP_DRAFT,
        status: AbandonmentEventStatus.ACTIVE,
      },
    });

    prisma.reminderJob.update.mockResolvedValue({
      id: 'job1',
      status: ReminderJobStatus.CANCELLED,
      abandonmentEvent: {
        id: 'event1',
        kind: AbandonmentKind.TRIP_DRAFT,
        status: AbandonmentEventStatus.ACTIVE,
      },
    });

    const result = await service.cancelReminderJob('job1');

    expect(result.action).toBe('CANCELLED');
    expect(prisma.reminderJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job1' },
        data: {
          status: ReminderJobStatus.CANCELLED,
        },
      }),
    );
  });

  it('should retry one cancelled reminder job', async () => {
    prisma.reminderJob.findUnique.mockResolvedValue({
      id: 'job1',
      status: ReminderJobStatus.CANCELLED,
      abandonmentEvent: {
        id: 'event1',
        kind: AbandonmentKind.TRIP_DRAFT,
        status: AbandonmentEventStatus.ACTIVE,
      },
    });

    prisma.reminderJob.update.mockResolvedValue({
      id: 'job1',
      status: ReminderJobStatus.PENDING,
      abandonmentEvent: {
        id: 'event1',
        kind: AbandonmentKind.TRIP_DRAFT,
        status: AbandonmentEventStatus.ACTIVE,
      },
    });

    const result = await service.retryReminderJob('job1');

    expect(result.action).toBe('REQUEUED');
    expect(prisma.reminderJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job1' },
        data: expect.objectContaining({
          status: ReminderJobStatus.PENDING,
          sentAt: null,
          lastError: null,
        }),
      }),
    );
  });

  it('should throw if reminder job is not found', async () => {
    prisma.reminderJob.findUnique.mockResolvedValue(null);

    await expect(service.triggerReminderJob('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should reject trigger for already sent reminder job', async () => {
    prisma.reminderJob.findUnique.mockResolvedValue({
      id: 'job1',
      status: ReminderJobStatus.SENT,
      abandonmentEvent: {
        id: 'event1',
        kind: AbandonmentKind.TRIP_DRAFT,
        status: AbandonmentEventStatus.ACTIVE,
      },
    });

    await expect(service.triggerReminderJob('job1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('should reject retry for pending reminder job', async () => {
    prisma.reminderJob.findUnique.mockResolvedValue({
      id: 'job1',
      status: ReminderJobStatus.PENDING,
      abandonmentEvent: {
        id: 'event1',
        kind: AbandonmentKind.TRIP_DRAFT,
        status: AbandonmentEventStatus.ACTIVE,
      },
    });

    await expect(service.retryReminderJob('job1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('should reject trigger for non-active abandonment event', async () => {
    prisma.reminderJob.findUnique.mockResolvedValue({
      id: 'job1',
      status: ReminderJobStatus.PENDING,
      abandonmentEvent: {
        id: 'event1',
        kind: AbandonmentKind.TRIP_DRAFT,
        status: AbandonmentEventStatus.RESOLVED,
      },
    });

    await expect(service.triggerReminderJob('job1')).rejects.toThrow(
      ConflictException,
    );
  });
});