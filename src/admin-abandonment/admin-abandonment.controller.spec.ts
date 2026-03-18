import { Test, TestingModule } from '@nestjs/testing';
import { ReminderChannel, ReminderJobStatus } from '@prisma/client';
import { AdminAbandonmentController } from './admin-abandonment.controller';
import { AdminAbandonmentService } from './admin-abandonment.service';

describe('AdminAbandonmentController', () => {
  let controller: AdminAbandonmentController;
  let service: jest.Mocked<AdminAbandonmentService>;

  beforeEach(async () => {
    const serviceMock: Partial<jest.Mocked<AdminAbandonmentService>> = {
      listAbandonmentEvents: jest.fn(),
      findAbandonmentEvent: jest.fn(),
      createReminderJobFromAbandonmentEvent: jest.fn(),
      createReminderJobsFromAbandonmentEvents: jest.fn(),
      resolveAbandonmentEvent: jest.fn(),
      dismissAbandonmentEvent: jest.fn(),
      listReminderJobs: jest.fn(),
      listDueReminderJobs: jest.fn(),
      listActionableReminderJobs: jest.fn(),
      triggerDueReminderJobs: jest.fn(),
      cancelDueReminderJobs: jest.fn(),
      triggerReminderJobs: jest.fn(),
      cancelReminderJobs: jest.fn(),
      retryReminderJobs: jest.fn(),
      triggerReminderJob: jest.fn(),
      cancelReminderJob: jest.fn(),
      retryReminderJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAbandonmentController],
      providers: [
        {
          provide: AdminAbandonmentService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get(AdminAbandonmentController);
    service = module.get(AdminAbandonmentService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate listAbandonmentEvents to service', async () => {
    const query = {
      userId: 'user1',
      limit: 10,
    };

    const expected = {
      items: [],
      limit: 10,
      filters: {
        userId: 'user1',
        kind: null,
        status: null,
      },
    };

    service.listAbandonmentEvents.mockResolvedValue(expected as any);

    const result = await controller.listAbandonmentEvents(query);

    expect(service.listAbandonmentEvents).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate findAbandonmentEvent to service', async () => {
    const expected = {
      id: 'event1',
      reminderJobs: [],
    };

    service.findAbandonmentEvent.mockResolvedValue(expected as any);

    const result = await controller.findAbandonmentEvent('event1');

    expect(service.findAbandonmentEvent).toHaveBeenCalledWith('event1');
    expect(result).toEqual(expected);
  });

  it('should delegate createReminderJobFromAbandonmentEvent to service', async () => {
    const body = {
      channel: ReminderChannel.EMAIL,
      scheduledFor: new Date('2026-03-18T09:00:00.000Z'),
      payload: {
        templateKey: 'abandonment_followup_manual',
      },
    };

    const expected = {
      action: 'CREATED',
      item: {
        id: 'job1',
        abandonmentEventId: 'event1',
        status: ReminderJobStatus.PENDING,
      },
    };

    service.createReminderJobFromAbandonmentEvent.mockResolvedValue(expected as any);

    const result = await controller.createReminderJobFromAbandonmentEvent(
      'event1',
      body,
    );

    expect(service.createReminderJobFromAbandonmentEvent).toHaveBeenCalledWith(
      'event1',
      body,
    );
    expect(result).toEqual(expected);
  });

  it('should delegate createReminderJobsFromAbandonmentEvents to service', async () => {
    const body = {
      eventIds: ['event1', 'event2'],
      channel: ReminderChannel.EMAIL,
      scheduledFor: new Date('2026-03-18T09:00:00.000Z'),
      payload: {
        templateKey: 'abandonment_followup_manual_batch',
      },
    };

    const expected = {
      action: 'CREATED_BATCH',
      requestedCount: 2,
      uniqueEventIdsCount: 2,
      createdCount: 1,
      skippedCount: 1,
      created: [
        {
          reminderJobId: 'job1',
          abandonmentEventId: 'event1',
          status: ReminderJobStatus.PENDING,
        },
      ],
      skipped: [
        {
          abandonmentEventId: 'event2',
          reason: 'ABANDONMENT_EVENT_NOT_ACTIVE',
        },
      ],
    };

    service.createReminderJobsFromAbandonmentEvents.mockResolvedValue(
      expected as any,
    );

    const result =
      await controller.createReminderJobsFromAbandonmentEvents(body);

    expect(
      service.createReminderJobsFromAbandonmentEvents,
    ).toHaveBeenCalledWith(body);
    expect(result).toEqual(expected);
  });

  it('should delegate resolveAbandonmentEvent to service', async () => {
    const body = {
      metadata: {
        reason: 'User completed the flow manually',
      },
    };

    const expected = {
      action: 'RESOLVED',
      item: {
        id: 'event1',
        status: 'RESOLVED',
      },
      cancelledPendingReminderJobsCount: 2,
      cancelledPendingReminderJobIds: ['job1', 'job2'],
    };

    service.resolveAbandonmentEvent.mockResolvedValue(expected as any);

    const result = await controller.resolveAbandonmentEvent('event1', body);

    expect(service.resolveAbandonmentEvent).toHaveBeenCalledWith('event1', body);
    expect(result).toEqual(expected);
  });

  it('should delegate dismissAbandonmentEvent to service', async () => {
    const body = {
      metadata: {
        reason: 'False positive',
      },
    };

    const expected = {
      action: 'DISMISSED',
      item: {
        id: 'event1',
        status: 'DISMISSED',
      },
      cancelledPendingReminderJobsCount: 2,
      cancelledPendingReminderJobIds: ['job1', 'job2'],
    };

    service.dismissAbandonmentEvent.mockResolvedValue(expected as any);

    const result = await controller.dismissAbandonmentEvent('event1', body);

    expect(service.dismissAbandonmentEvent).toHaveBeenCalledWith('event1', body);
    expect(result).toEqual(expected);
  });

  it('should delegate listReminderJobs to service', async () => {
    const query = {
      abandonmentEventId: 'event1',
      status: ReminderJobStatus.PENDING,
      channel: ReminderChannel.EMAIL,
      limit: 10,
    };

    const expected = {
      items: [],
      limit: 10,
      filters: {
        abandonmentEventId: 'event1',
        status: ReminderJobStatus.PENDING,
        channel: ReminderChannel.EMAIL,
      },
    };

    service.listReminderJobs.mockResolvedValue(expected as any);

    const result = await controller.listReminderJobs(query);

    expect(service.listReminderJobs).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate listDueReminderJobs to service', async () => {
    const query = {
      channel: ReminderChannel.EMAIL,
      limit: 10,
    };

    const expected = {
      items: [],
      limit: 10,
      serverTime: new Date().toISOString(),
      filters: {
        channel: ReminderChannel.EMAIL,
        dueOnly: true,
        status: ReminderJobStatus.PENDING,
      },
    };

    service.listDueReminderJobs.mockResolvedValue(expected as any);

    const result = await controller.listDueReminderJobs(query);

    expect(service.listDueReminderJobs).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate listActionableReminderJobs to service', async () => {
    const query = {
      channel: ReminderChannel.EMAIL,
      limit: 10,
    };

    const expected = {
      items: [],
      limit: 10,
      serverTime: new Date().toISOString(),
      summary: {
        duePendingCount: 0,
        failedCount: 0,
        cancelledCount: 0,
        actionableCount: 0,
      },
      filters: {
        channel: ReminderChannel.EMAIL,
      },
    };

    service.listActionableReminderJobs.mockResolvedValue(expected as any);

    const result = await controller.listActionableReminderJobs(query);

    expect(service.listActionableReminderJobs).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate triggerDueReminderJobs to service', async () => {
    const query = {
      channel: ReminderChannel.EMAIL,
      limit: 10,
    };

    const expected = {
      action: 'TRIGGERED_DUE_BATCH',
      processedCount: 0,
      items: [],
    };

    service.triggerDueReminderJobs.mockResolvedValue(expected as any);

    const result = await controller.triggerDueReminderJobs(query);

    expect(service.triggerDueReminderJobs).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate cancelDueReminderJobs to service', async () => {
    const query = {
      channel: ReminderChannel.EMAIL,
      limit: 10,
    };

    const expected = {
      action: 'CANCELLED_DUE_BATCH',
      processedCount: 0,
      items: [],
    };

    service.cancelDueReminderJobs.mockResolvedValue(expected as any);

    const result = await controller.cancelDueReminderJobs(query);

    expect(service.cancelDueReminderJobs).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate triggerReminderJobs to service', async () => {
    const query = {
      abandonmentEventId: 'event1',
      status: ReminderJobStatus.PENDING,
      channel: ReminderChannel.EMAIL,
      limit: 10,
    };

    const expected = {
      action: 'TRIGGERED_BATCH',
      processedCount: 0,
      items: [],
    };

    service.triggerReminderJobs.mockResolvedValue(expected as any);

    const result = await controller.triggerReminderJobs(query);

    expect(service.triggerReminderJobs).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate cancelReminderJobs to service', async () => {
    const query = {
      abandonmentEventId: 'event1',
      status: ReminderJobStatus.FAILED,
      channel: ReminderChannel.EMAIL,
      limit: 10,
    };

    const expected = {
      action: 'CANCELLED_BATCH',
      processedCount: 0,
      items: [],
    };

    service.cancelReminderJobs.mockResolvedValue(expected as any);

    const result = await controller.cancelReminderJobs(query);

    expect(service.cancelReminderJobs).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate retryReminderJobs to service', async () => {
    const query = {
      status: ReminderJobStatus.CANCELLED,
      channel: ReminderChannel.EMAIL,
      limit: 10,
    };

    const expected = {
      action: 'RETRIED_BATCH',
      processedCount: 0,
      items: [],
    };

    service.retryReminderJobs.mockResolvedValue(expected as any);

    const result = await controller.retryReminderJobs(query);

    expect(service.retryReminderJobs).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate triggerReminderJob to service', async () => {
    const expected = {
      action: 'TRIGGERED',
      item: {
        id: 'job1',
      },
    };

    service.triggerReminderJob.mockResolvedValue(expected as any);

    const result = await controller.triggerReminderJob('job1');

    expect(service.triggerReminderJob).toHaveBeenCalledWith('job1');
    expect(result).toEqual(expected);
  });

  it('should delegate cancelReminderJob to service', async () => {
    const expected = {
      action: 'CANCELLED',
      item: {
        id: 'job1',
      },
    };

    service.cancelReminderJob.mockResolvedValue(expected as any);

    const result = await controller.cancelReminderJob('job1');

    expect(service.cancelReminderJob).toHaveBeenCalledWith('job1');
    expect(result).toEqual(expected);
  });

  it('should delegate retryReminderJob to service', async () => {
    const expected = {
      action: 'REQUEUED',
      item: {
        id: 'job1',
      },
    };

    service.retryReminderJob.mockResolvedValue(expected as any);

    const result = await controller.retryReminderJob('job1');

    expect(service.retryReminderJob).toHaveBeenCalledWith('job1');
    expect(result).toEqual(expected);
  });
});