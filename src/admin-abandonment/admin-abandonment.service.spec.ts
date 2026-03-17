import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  AbandonmentEventStatus,
  AbandonmentKind,
  ReminderChannel,
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
        update: jest.fn(),
      },
      reminderJob: {
        create: jest.fn(),
        findFirst: jest.fn(),
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

  it('should create one reminder job from one active abandonment event', async () => {
    prisma.abandonmentEvent.findUnique.mockResolvedValue({
      id: 'event1',
      kind: AbandonmentKind.TRIP_DRAFT,
      status: AbandonmentEventStatus.ACTIVE,
      reminderJobs: [],
    });

    prisma.reminderJob.findFirst.mockResolvedValue(null);

    prisma.reminderJob.create.mockResolvedValue({
      id: 'job1',
      abandonmentEventId: 'event1',
      channel: ReminderChannel.EMAIL,
      scheduledFor: new Date('2026-03-18T09:00:00.000Z'),
      status: ReminderJobStatus.PENDING,
      abandonmentEvent: {
        id: 'event1',
        kind: AbandonmentKind.TRIP_DRAFT,
        status: AbandonmentEventStatus.ACTIVE,
      },
    });

    const result = await service.createReminderJobFromAbandonmentEvent('event1', {
      channel: ReminderChannel.EMAIL,
      scheduledFor: new Date('2026-03-18T09:00:00.000Z'),
      payload: {
        templateKey: 'abandonment_followup_manual',
      },
    });

    expect(prisma.reminderJob.findFirst).toHaveBeenCalledWith({
      where: {
        abandonmentEventId: 'event1',
        channel: ReminderChannel.EMAIL,
        status: ReminderJobStatus.PENDING,
        scheduledFor: new Date('2026-03-18T09:00:00.000Z'),
      },
    });

    expect(prisma.reminderJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          abandonmentEventId: 'event1',
          channel: ReminderChannel.EMAIL,
          status: ReminderJobStatus.PENDING,
        }),
        include: {
          abandonmentEvent: true,
        },
      }),
    );

    expect(result.action).toBe('CREATED');
    expect(result.item.id).toBe('job1');
  });

  it('should reject create reminder job when abandonment event is not active', async () => {
    prisma.abandonmentEvent.findUnique.mockResolvedValue({
      id: 'event1',
      kind: AbandonmentKind.TRIP_DRAFT,
      status: AbandonmentEventStatus.RESOLVED,
      reminderJobs: [],
    });

    await expect(
      service.createReminderJobFromAbandonmentEvent('event1', {
        channel: ReminderChannel.EMAIL,
        scheduledFor: new Date('2026-03-18T09:00:00.000Z'),
      }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.reminderJob.findFirst).not.toHaveBeenCalled();
    expect(prisma.reminderJob.create).not.toHaveBeenCalled();
  });

  it('should reject create reminder job when exact pending duplicate exists', async () => {
    prisma.abandonmentEvent.findUnique.mockResolvedValue({
      id: 'event1',
      kind: AbandonmentKind.TRIP_DRAFT,
      status: AbandonmentEventStatus.ACTIVE,
      reminderJobs: [],
    });

    prisma.reminderJob.findFirst.mockResolvedValue({
      id: 'job-existing',
      abandonmentEventId: 'event1',
      channel: ReminderChannel.EMAIL,
      scheduledFor: new Date('2026-03-18T09:00:00.000Z'),
      status: ReminderJobStatus.PENDING,
    });

    await expect(
      service.createReminderJobFromAbandonmentEvent('event1', {
        channel: ReminderChannel.EMAIL,
        scheduledFor: new Date('2026-03-18T09:00:00.000Z'),
      }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.reminderJob.create).not.toHaveBeenCalled();
  });

  it('should create reminder jobs in batch and skip invalid entries', async () => {
    prisma.abandonmentEvent.findUnique
      .mockResolvedValueOnce({
        id: 'event1',
        kind: AbandonmentKind.TRIP_DRAFT,
        status: AbandonmentEventStatus.ACTIVE,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'event3',
        kind: AbandonmentKind.KYC_PENDING,
        status: AbandonmentEventStatus.RESOLVED,
      })
      .mockResolvedValueOnce({
        id: 'event4',
        kind: AbandonmentKind.PAYMENT_PENDING,
        status: AbandonmentEventStatus.ACTIVE,
      });

    prisma.reminderJob.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'job-duplicate',
        abandonmentEventId: 'event4',
        status: ReminderJobStatus.PENDING,
      });

    prisma.reminderJob.create.mockResolvedValue({
      id: 'job1',
      abandonmentEventId: 'event1',
      status: ReminderJobStatus.PENDING,
    });

    const result = await service.createReminderJobsFromAbandonmentEvents({
      eventIds: ['event1', 'missing-event', 'event3', 'event4', 'event1'],
      channel: ReminderChannel.EMAIL,
      scheduledFor: new Date('2026-03-18T09:00:00.000Z'),
      payload: {
        templateKey: 'abandonment_followup_manual_batch',
      },
    });

    expect(result.action).toBe('CREATED_BATCH');
    expect(result.requestedCount).toBe(5);
    expect(result.uniqueEventIdsCount).toBe(4);
    expect(result.createdCount).toBe(1);
    expect(result.skippedCount).toBe(3);

    expect(result.created).toEqual([
      {
        reminderJobId: 'job1',
        abandonmentEventId: 'event1',
        status: ReminderJobStatus.PENDING,
      },
    ]);

    expect(result.skipped).toEqual([
      {
        abandonmentEventId: 'missing-event',
        reason: 'ABANDONMENT_EVENT_NOT_FOUND',
      },
      {
        abandonmentEventId: 'event3',
        reason: 'ABANDONMENT_EVENT_NOT_ACTIVE',
      },
      {
        abandonmentEventId: 'event4',
        reason: 'DUPLICATE_PENDING_REMINDER_JOB',
      },
    ]);
  });

  it('should resolve active abandonment event and cancel pending reminder jobs', async () => {
    prisma.abandonmentEvent.findUnique.mockResolvedValue({
      id: 'event1',
      kind: AbandonmentKind.TRIP_DRAFT,
      status: AbandonmentEventStatus.ACTIVE,
      metadata: { existing: true },
      reminderJobs: [],
    });

    prisma.reminderJob.findMany.mockResolvedValue([
      {
        id: 'job1',
        abandonmentEventId: 'event1',
        status: ReminderJobStatus.PENDING,
        payload: { foo: 'bar' },
      },
      {
        id: 'job2',
        abandonmentEventId: 'event1',
        status: ReminderJobStatus.PENDING,
        payload: null,
      },
    ]);

    prisma.reminderJob.update.mockResolvedValue({});

    prisma.abandonmentEvent.update.mockResolvedValue({
      id: 'event1',
      status: AbandonmentEventStatus.RESOLVED,
      reminderJobs: [],
    });

    const result = await service.resolveAbandonmentEvent('event1', {
      metadata: {
        reason: 'completed',
      },
    });

    expect(prisma.reminderJob.findMany).toHaveBeenCalledWith({
      where: {
        abandonmentEventId: 'event1',
        status: ReminderJobStatus.PENDING,
      },
      orderBy: [{ scheduledFor: 'asc' }, { id: 'desc' }],
    });

    expect(prisma.reminderJob.update).toHaveBeenCalledTimes(2);
    expect(prisma.abandonmentEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event1' },
        data: expect.objectContaining({
          status: AbandonmentEventStatus.RESOLVED,
        }),
        include: {
          reminderJobs: true,
        },
      }),
    );

    expect(result.action).toBe('RESOLVED');
    expect(result.cancelledPendingReminderJobsCount).toBe(2);
    expect(result.cancelledPendingReminderJobIds).toEqual(['job1', 'job2']);
  });

  it('should reject resolve when abandonment event is not active', async () => {
    prisma.abandonmentEvent.findUnique.mockResolvedValue({
      id: 'event1',
      kind: AbandonmentKind.TRIP_DRAFT,
      status: AbandonmentEventStatus.RESOLVED,
      metadata: {},
      reminderJobs: [],
    });

    await expect(
      service.resolveAbandonmentEvent('event1', {}),
    ).rejects.toThrow(ConflictException);

    expect(prisma.reminderJob.findMany).not.toHaveBeenCalled();
    expect(prisma.abandonmentEvent.update).not.toHaveBeenCalled();
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

    expect(prisma.reminderJob.update).toHaveBeenCalledTimes(2);
    expect(result.action).toBe('TRIGGERED_DUE_BATCH');
    expect(result.processedCount).toBe(2);
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

    expect(prisma.reminderJob.update).toHaveBeenCalledTimes(2);
    expect(result.action).toBe('CANCELLED_DUE_BATCH');
    expect(result.processedCount).toBe(2);
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
        }),
        take: 10,
      }),
    );
    expect(prisma.reminderJob.update).toHaveBeenCalledTimes(2);
    expect(result.action).toBe('TRIGGERED_BATCH');
    expect(result.processedCount).toBe(2);
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

  it('should cancel reminder jobs in batch with default statuses', async () => {
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
        status: ReminderJobStatus.FAILED,
        abandonmentEvent: {
          id: 'event2',
          kind: AbandonmentKind.PAYMENT_PENDING,
          status: AbandonmentEventStatus.ACTIVE,
        },
      },
    ]);

    prisma.reminderJob.update.mockResolvedValue({});

    const result = await service.cancelReminderJobs({ limit: 10 });

    expect(prisma.reminderJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: [ReminderJobStatus.PENDING, ReminderJobStatus.FAILED] },
          abandonmentEvent: {
            status: AbandonmentEventStatus.ACTIVE,
          },
        }),
        take: 10,
      }),
    );
    expect(prisma.reminderJob.update).toHaveBeenCalledTimes(2);
    expect(result.action).toBe('CANCELLED_BATCH');
    expect(result.processedCount).toBe(2);
  });

  it('should cancel reminder jobs in batch with explicit FAILED status', async () => {
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

    const result = await service.cancelReminderJobs({
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
    expect(result.action).toBe('CANCELLED_BATCH');
    expect(result.processedCount).toBe(1);
  });

  it('should ignore unsupported cancel batch status and fallback to PENDING/FAILED', async () => {
    prisma.reminderJob.findMany.mockResolvedValue([]);

    const result = await service.cancelReminderJobs({
      status: ReminderJobStatus.CANCELLED,
      limit: 10,
    });

    expect(prisma.reminderJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: [ReminderJobStatus.PENDING, ReminderJobStatus.FAILED] },
        }),
      }),
    );
    expect(result.action).toBe('CANCELLED_BATCH');
    expect(result.processedCount).toBe(0);
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

    expect(prisma.reminderJob.update).toHaveBeenCalledTimes(2);
    expect(result.action).toBe('RETRIED_BATCH');
    expect(result.processedCount).toBe(2);
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