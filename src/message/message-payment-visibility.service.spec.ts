import { ForbiddenException } from '@nestjs/common';
import { MessageService } from './message.service';

describe('MessageService - payment visibility', () => {
  let service: MessageService;

  const prisma = {
    transaction: {
      findUnique: jest.fn(),
    },
    conversation: {
      upsert: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    messageModerationEvent: {
      create: jest.fn(),
    },
  };

  const sanitizer = {
    sanitize: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new MessageService(prisma as any, sanitizer as any);
  });

  it('blocks participant messaging before payment confirmation', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: 'PENDING',
    });

    await expect(
      service.sendMessage(
        'tx-1',
        { userId: 'sender-1', role: 'USER' },
        'Bonjour',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks participant message listing before payment confirmation', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: 'PENDING',
    });

    await expect(
      service.listMessages('tx-1', { userId: 'traveler-1', role: 'USER' }, {}),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows participant messaging after payment confirmation', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: 'SUCCESS',
    });

    prisma.conversation.upsert.mockResolvedValue({
      id: 'conv-1',
      transactionId: 'tx-1',
      createdAt: new Date('2026-04-01T10:00:00.000Z'),
    });

    sanitizer.sanitize.mockReturnValue({
      content: 'Bonjour',
      isRedacted: false,
      status: 'CLEAN',
      reasons: [],
    });

    prisma.message.findMany.mockResolvedValue([]);

    prisma.message.create.mockResolvedValue({
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'sender-1',
      content: 'Bonjour',
      isRedacted: false,
      createdAt: new Date('2026-04-01T10:01:00.000Z'),
    });

    const result = await service.sendMessage(
      'tx-1',
      { userId: 'sender-1', role: 'USER' },
      'Bonjour',
    );

    expect(result.transactionId).toBe('tx-1');
    expect(result.conversationId).toBe('conv-1');
    expect(result.message.id).toBe('msg-1');
  });

  it('allows admin message listing before payment confirmation', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: 'PENDING',
    });

    prisma.conversation.upsert.mockResolvedValue({
      id: 'conv-1',
      transactionId: 'tx-1',
      createdAt: new Date('2026-04-01T10:00:00.000Z'),
    });

    prisma.message.findMany.mockResolvedValue([]);

    const result = await service.listMessages(
      'tx-1',
      { userId: 'admin-1', role: 'ADMIN' },
      {},
    );

    expect(result.transactionId).toBe('tx-1');
    expect(result.conversationId).toBe('conv-1');
    expect(result.items).toEqual([]);
  });
});