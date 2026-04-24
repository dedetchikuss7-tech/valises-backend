import {
  AdminTimelineObjectType,
  AdminTimelineSeverity,
} from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { AdminTimelineService } from './admin-timeline.service';
import {
  AdminTimelineSortBy,
  SortOrder,
} from './dto/list-admin-timeline-events-query.dto';

describe('AdminTimelineService', () => {
  let service: AdminTimelineService;

  const prismaMock = {
    adminTimelineEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminTimelineService(prismaMock as any);
  });

  it('creates a manual timeline event', async () => {
    prismaMock.adminTimelineEvent.create.mockResolvedValue({
      id: 'evt1',
      objectType: AdminTimelineObjectType.DISPUTE,
      objectId: 'disp1',
      eventType: 'ADMIN_NOTE_ADDED',
      title: 'Admin note added',
      message: 'A note was added',
      actorUserId: 'admin1',
      severity: AdminTimelineSeverity.INFO,
      metadata: { note: 'hello' },
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    const result = await service.createManualEvent('admin1', {
      objectType: AdminTimelineObjectType.DISPUTE,
      objectId: 'disp1',
      eventType: 'ADMIN_NOTE_ADDED',
      title: 'Admin note added',
      message: 'A note was added',
      severity: AdminTimelineSeverity.INFO,
      metadata: { note: 'hello' },
    });

    expect(prismaMock.adminTimelineEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        objectType: AdminTimelineObjectType.DISPUTE,
        objectId: 'disp1',
        eventType: 'ADMIN_NOTE_ADDED',
        actorUserId: 'admin1',
      }),
    });
    expect(result.id).toBe('evt1');
  });

  it('records a safe event without throwing when persistence fails', async () => {
    prismaMock.adminTimelineEvent.create.mockRejectedValue(
      new Error('database unavailable'),
    );

    await expect(
      service.recordSafe({
        objectType: AdminTimelineObjectType.AML,
        objectId: 'aml1',
        eventType: 'TEST_EVENT',
        title: 'Test event',
      }),
    ).resolves.toBeUndefined();
  });

  it('lists timeline events with filters and pagination', async () => {
    prismaMock.adminTimelineEvent.findMany.mockResolvedValue([
      {
        id: 'evt1',
        objectType: AdminTimelineObjectType.AML,
        objectId: 'aml1',
        eventType: 'ADMIN_OWNERSHIP_CLAIMED',
        title: 'Ownership claimed',
        message: 'Admin claimed this object',
        actorUserId: 'admin1',
        severity: AdminTimelineSeverity.INFO,
        metadata: {},
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
      },
      {
        id: 'evt2',
        objectType: AdminTimelineObjectType.AML,
        objectId: 'aml1',
        eventType: 'ADMIN_OWNERSHIP_STATUS_UPDATED',
        title: 'Ownership status updated',
        message: 'Admin updated this object',
        actorUserId: 'admin1',
        severity: AdminTimelineSeverity.SUCCESS,
        metadata: {},
        createdAt: new Date('2099-01-01T01:00:00.000Z'),
      },
    ]);

    const result = await service.list({
      objectType: AdminTimelineObjectType.AML,
      objectId: 'aml1',
      q: 'claimed',
      sortBy: AdminTimelineSortBy.CREATED_AT,
      sortOrder: SortOrder.DESC,
      limit: 20,
      offset: 0,
    });

    expect(prismaMock.adminTimelineEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          objectType: AdminTimelineObjectType.AML,
          objectId: 'aml1',
        }),
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0].eventType).toBe('ADMIN_OWNERSHIP_CLAIMED');
  });

  it('lists timeline events for one object', async () => {
    prismaMock.adminTimelineEvent.findMany.mockResolvedValue([]);

    const result = await service.listForObject(
      AdminTimelineObjectType.PAYOUT,
      'pay1',
      {
        limit: 10,
        offset: 0,
      },
    );

    expect(prismaMock.adminTimelineEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          objectType: AdminTimelineObjectType.PAYOUT,
          objectId: 'pay1',
        }),
      }),
    );
    expect(result.total).toBe(0);
  });

  it('gets one timeline event', async () => {
    prismaMock.adminTimelineEvent.findUnique.mockResolvedValue({
      id: 'evt1',
      objectType: AdminTimelineObjectType.REFUND,
      objectId: 'ref1',
      eventType: 'REFUND_REVIEWED',
      title: 'Refund reviewed',
      message: null,
      actorUserId: 'admin1',
      severity: AdminTimelineSeverity.INFO,
      metadata: null,
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    const result = await service.getOne('evt1');

    expect(prismaMock.adminTimelineEvent.findUnique).toHaveBeenCalledWith({
      where: { id: 'evt1' },
    });
    expect(result.id).toBe('evt1');
  });

  it('throws not found when one timeline event does not exist', async () => {
    prismaMock.adminTimelineEvent.findUnique.mockResolvedValue(null);

    await expect(service.getOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});