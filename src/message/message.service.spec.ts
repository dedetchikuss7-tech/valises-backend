import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageSanitizerService } from './message-sanitizer.service';

describe('MessageService', () => {
  let service: MessageService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
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
    };

    service = new MessageService(prisma, new MessageSanitizerService());
  });

  it('should reject unauthorized user', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      senderId: 'sender1',
      travelerId: 'traveler1',
    });

    await expect(
      service.listMessages(
        'tx1',
        { userId: 'other-user', role: 'USER' },
        { limit: 10 },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should allow sender to list messages', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      senderId: 'sender1',
      travelerId: 'traveler1',
    });

    prisma.conversation.upsert.mockResolvedValue({
      id: 'conv1',
      transactionId: 'tx1',
      createdAt: new Date(),
    });

    prisma.message.findMany.mockResolvedValue([
      {
        id: 'msg1',
        senderId: 'sender1',
        content: 'hello',
        isRedacted: false,
        createdAt: new Date(),
      },
    ]);

    const result = await service.listMessages(
      'tx1',
      { userId: 'sender1', role: 'USER' },
      { limit: 10 },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].content).toBe('hello');
    expect(prisma.message.findMany).toHaveBeenCalled();
  });

  it('should allow traveler to list messages', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      senderId: 'sender1',
      travelerId: 'traveler1',
    });

    prisma.conversation.upsert.mockResolvedValue({
      id: 'conv1',
      transactionId: 'tx1',
      createdAt: new Date(),
    });

    prisma.message.findMany.mockResolvedValue([]);

    const result = await service.listMessages(
      'tx1',
      { userId: 'traveler1', role: 'USER' },
      { limit: 10 },
    );

    expect(result.items).toEqual([]);
  });

  it('should allow admin to list messages', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      senderId: 'sender1',
      travelerId: 'traveler1',
    });

    prisma.conversation.upsert.mockResolvedValue({
      id: 'conv1',
      transactionId: 'tx1',
      createdAt: new Date(),
    });

    prisma.message.findMany.mockResolvedValue([]);

    const result = await service.listMessages(
      'tx1',
      { userId: 'admin1', role: 'ADMIN' },
      { limit: 10 },
    );

    expect(result.items).toEqual([]);
  });

  it('should create conversation automatically with upsert when sending message', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      senderId: 'sender1',
      travelerId: 'traveler1',
    });

    prisma.conversation.upsert.mockResolvedValue({
      id: 'conv-created',
      transactionId: 'tx1',
      createdAt: new Date(),
    });

    prisma.message.findMany.mockResolvedValue([]);

    prisma.message.create.mockResolvedValue({
      id: 'msg1',
      conversationId: 'conv-created',
      senderId: 'sender1',
      content: 'Bonjour [phone redacted]',
      isRedacted: true,
      createdAt: new Date(),
    });

    const result = await service.sendMessage(
      'tx1',
      { userId: 'sender1', role: 'USER' },
      'Bonjour 699001122',
    );

    expect(prisma.conversation.upsert).toHaveBeenCalled();
    expect(result.message.isRedacted).toBe(true);
    expect(result.message.content).toContain('[phone redacted]');
    expect(result.moderation.status).toBe('SANITIZED');
  });

  it('should throw if transaction not found', async () => {
    prisma.transaction.findUnique.mockResolvedValue(null);

    await expect(
      service.sendMessage(
        'missing-tx',
        { userId: 'sender1', role: 'USER' },
        'Hello',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should sanitize links and emails before saving', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      senderId: 'sender1',
      travelerId: 'traveler1',
    });

    prisma.conversation.upsert.mockResolvedValue({
      id: 'conv1',
      transactionId: 'tx1',
      createdAt: new Date(),
    });

    prisma.message.findMany.mockResolvedValue([]);

    prisma.message.create.mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: 'msg1',
        conversationId: data.conversationId,
        senderId: data.senderId,
        content: data.content,
        isRedacted: data.isRedacted,
        createdAt: new Date(),
      }),
    );

    const result = await service.sendMessage(
      'tx1',
      { userId: 'sender1', role: 'USER' },
      'Contacte moi sur test@gmail.com ou https://wa.me/123456 mais continuons ici',
    );

    expect(result.message.isRedacted).toBe(true);
    expect(result.message.content).toContain('[email redacted]');
    expect(result.message.content).toContain('[link redacted]');
    expect(result.moderation.status).toBe('SANITIZED');
  });

  it('should block pure contact-sharing messages', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      senderId: 'sender1',
      travelerId: 'traveler1',
    });

    prisma.conversation.upsert.mockResolvedValue({
      id: 'conv1',
      transactionId: 'tx1',
      createdAt: new Date(),
    });

    await expect(
      service.sendMessage(
        'tx1',
        { userId: 'sender1', role: 'USER' },
        'WhatsApp 699001122',
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('should block duplicate recent messages from the same sender', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      senderId: 'sender1',
      travelerId: 'traveler1',
    });

    prisma.conversation.upsert.mockResolvedValue({
      id: 'conv1',
      transactionId: 'tx1',
      createdAt: new Date(),
    });

    prisma.message.findMany.mockResolvedValue([
      {
        id: 'msg-prev',
        content: 'Bonjour, toujours disponible ici.',
        createdAt: new Date(),
      },
    ]);

    await expect(
      service.sendMessage(
        'tx1',
        { userId: 'sender1', role: 'USER' },
        'Bonjour, toujours disponible ici.',
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('should return nextCursor when limit is reached', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      senderId: 'sender1',
      travelerId: 'traveler1',
    });

    prisma.conversation.upsert.mockResolvedValue({
      id: 'conv1',
      transactionId: 'tx1',
      createdAt: new Date(),
    });

    prisma.message.findMany.mockResolvedValue([
      {
        id: 'msg2',
        senderId: 'sender1',
        content: 'two',
        isRedacted: false,
        createdAt: new Date(),
      },
      {
        id: 'msg1',
        senderId: 'traveler1',
        content: 'one',
        isRedacted: false,
        createdAt: new Date(),
      },
    ]);

    const result = await service.listMessages(
      'tx1',
      { userId: 'sender1', role: 'USER' },
      { limit: 2 },
    );

    expect(result.nextCursor).toBe('msg1');
  });
});