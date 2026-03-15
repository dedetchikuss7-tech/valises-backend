import { NotFoundException } from '@nestjs/common';
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
});