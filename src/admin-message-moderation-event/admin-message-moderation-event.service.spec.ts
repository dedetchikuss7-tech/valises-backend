import { NotFoundException } from '@nestjs/common';
import { AdminMessageModerationEventService } from './admin-message-moderation-event.service';

describe('AdminMessageModerationEventService', () => {
  let service: AdminMessageModerationEventService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      messageModerationEvent: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    service = new AdminMessageModerationEventService(prisma);
  });

  it('should list moderation events with default limit', async () => {
    prisma.messageModerationEvent.findMany.mockResolvedValue([
      {
        id: 'mme1',
        transactionId: 'tx1',
        conversationId: 'conv1',
        senderId: 'user1',
        kind: 'BLOCKED',
        code: 'MESSAGE_BLOCKED_CONTACT',
        message: 'Blocked',
        reasons: ['phone'],
        metadata: { foo: 'bar' },
        createdAt: new Date(),
      },
    ]);

    const result = await service.list({});

    expect(prisma.messageModerationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.limit).toBe(50);
  });

  it('should apply filters when listing moderation events', async () => {
    prisma.messageModerationEvent.findMany.mockResolvedValue([]);

    await service.list({
      transactionId: 'tx1',
      senderId: 'user1',
      kind: 'BLOCKED',
      code: 'MESSAGE_BLOCKED_CONTACT',
      limit: 25,
    });

    expect(prisma.messageModerationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          transactionId: 'tx1',
          senderId: 'user1',
          kind: 'BLOCKED',
          code: 'MESSAGE_BLOCKED_CONTACT',
        },
        take: 25,
      }),
    );
  });

  it('should return one moderation event by id', async () => {
    prisma.messageModerationEvent.findUnique.mockResolvedValue({
      id: 'mme1',
      transactionId: 'tx1',
      conversationId: 'conv1',
      senderId: 'user1',
      kind: 'BLOCKED',
      code: 'MESSAGE_BLOCKED_CONTACT',
      message: 'Blocked',
      reasons: ['phone'],
      metadata: { foo: 'bar' },
      createdAt: new Date(),
    });

    const result = await service.findOne('mme1');

    expect(result.id).toBe('mme1');
    expect(prisma.messageModerationEvent.findUnique).toHaveBeenCalledWith({
      where: { id: 'mme1' },
      select: expect.any(Object),
    });
  });

  it('should throw if moderation event is not found', async () => {
    prisma.messageModerationEvent.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});