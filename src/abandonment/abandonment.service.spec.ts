import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AbandonmentKind, Role } from '@prisma/client';
import { AbandonmentService } from './abandonment.service';

describe('AbandonmentService', () => {
  let service: AbandonmentService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      abandonmentEvent: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      reminderJob: {
        updateMany: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new AbandonmentService(prisma);
  });

  it('should create a new abandonment event with reminder jobs', async () => {
    prisma.abandonmentEvent.findFirst.mockResolvedValue(null);
    prisma.abandonmentEvent.create.mockResolvedValue({
      id: 'event1',
      kind: AbandonmentKind.TRIP_DRAFT,
      reminderJobs: [{ id: 'r1' }, { id: 'r2' }],
    });

    const result = await service.markAbandoned(
      { userId: 'user1', role: Role.USER },
      {
        kind: AbandonmentKind.TRIP_DRAFT,
        tripId: '11111111-1111-1111-1111-111111111111',
      },
    );

    expect(result.id).toBe('event1');
    expect(prisma.abandonmentEvent.create).toHaveBeenCalled();
  });

  it('should reject markAbandoned without entity reference', async () => {
    await expect(
      service.markAbandoned(
        { userId: 'user1', role: Role.USER },
        {
          kind: AbandonmentKind.TRIP_DRAFT,
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should update existing active abandonment event', async () => {
    prisma.abandonmentEvent.findFirst.mockResolvedValue({
      id: 'event-existing',
      userId: 'user1',
      kind: AbandonmentKind.TRIP_DRAFT,
      reminderJobs: [],
    });

    prisma.abandonmentEvent.update.mockResolvedValue({
      id: 'event-existing',
      userId: 'user1',
      kind: AbandonmentKind.TRIP_DRAFT,
      reminderJobs: [],
    });

    const result = await service.markAbandoned(
      { userId: 'user1', role: Role.USER },
      {
        kind: AbandonmentKind.TRIP_DRAFT,
        tripId: '11111111-1111-1111-1111-111111111111',
        metadata: { step: 'draft' },
      },
    );

    expect(result.id).toBe('event-existing');
    expect(prisma.abandonmentEvent.update).toHaveBeenCalled();
  });

  it('should resolve active events by reference', async () => {
    prisma.abandonmentEvent.findMany.mockResolvedValue([{ id: 'event1' }, { id: 'event2' }]);
    prisma.abandonmentEvent.updateMany.mockResolvedValue({ count: 2 });
    prisma.reminderJob.updateMany.mockResolvedValue({ count: 4 });

    const result = await service.resolveActiveByReference({
      userId: 'user1',
      kind: AbandonmentKind.TRIP_DRAFT,
      tripId: '11111111-1111-1111-1111-111111111111',
    });

    expect(result.resolvedCount).toBe(2);
    expect(prisma.abandonmentEvent.updateMany).toHaveBeenCalled();
    expect(prisma.reminderJob.updateMany).toHaveBeenCalled();
  });

  it('should resolve event for owner', async () => {
    prisma.abandonmentEvent.findUnique
      .mockResolvedValueOnce({
        id: 'event1',
        userId: 'user1',
        reminderJobs: [],
      })
      .mockResolvedValueOnce({
        id: 'event1',
        userId: 'user1',
        status: 'RESOLVED',
        reminderJobs: [],
      });

    prisma.abandonmentEvent.update.mockResolvedValue({});
    prisma.reminderJob.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.resolveAbandoned(
      { userId: 'user1', role: Role.USER },
      { eventId: 'event1' },
    );

    expect(result?.status).toBe('RESOLVED');
    expect(prisma.reminderJob.updateMany).toHaveBeenCalled();
  });

  it('should throw if abandonment event not found', async () => {
    prisma.abandonmentEvent.findUnique.mockResolvedValue(null);

    await expect(
      service.resolveAbandoned(
        { userId: 'user1', role: Role.USER },
        { eventId: 'missing' },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should allow only admin to process due reminders', async () => {
    await expect(
      service.processDueReminders({ userId: 'user1', role: Role.USER }, 10),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should process due reminders for admin', async () => {
    prisma.reminderJob.findMany.mockResolvedValue([
      {
        id: 'job1',
        abandonmentEventId: 'event1',
        payload: { template: 'abandonment_reminder_30m' },
        abandonmentEvent: {
          kind: AbandonmentKind.TRIP_DRAFT,
          status: 'ACTIVE',
        },
      },
    ]);

    prisma.reminderJob.update.mockResolvedValue({
      id: 'job1',
      status: 'SENT',
    });

    const result = await service.processDueReminders(
      { userId: 'admin1', role: Role.ADMIN },
      10,
    );

    expect(result.processedCount).toBe(1);
    expect(prisma.reminderJob.update).toHaveBeenCalled();
  });
});