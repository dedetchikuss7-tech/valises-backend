import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageSanitizerService } from './message-sanitizer.service';

type Requester = { userId: string; role: string };

@Injectable()
export class MessageService {
  private static readonly DUPLICATE_LOOKBACK = 5;
  private static readonly COOLDOWN_MS = 15_000;
  private static readonly BURST_WINDOW_MS = 2 * 60 * 1000;
  private static readonly BURST_MAX_MESSAGES = 5;
  private static readonly MICRO_MESSAGE_LENGTH = 4;
  private static readonly MICRO_BURST_THRESHOLD = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sanitizer: MessageSanitizerService,
  ) {}

  private async assertCanAccessTransaction(transactionId: string, requester: Requester) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        senderId: true,
        travelerId: true,
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    const isAdmin = requester.role === 'ADMIN';
    const isParty = requester.userId === tx.senderId || requester.userId === tx.travelerId;

    if (!isAdmin && !isParty) {
      throw new ForbiddenException('Not allowed');
    }

    return tx;
  }

  private async getOrCreateConversation(transactionId: string) {
    return this.prisma.conversation.upsert({
      where: { transactionId },
      update: {},
      create: { transactionId },
      select: {
        id: true,
        transactionId: true,
        createdAt: true,
      },
    });
  }

  private normalizeForDuplicateCheck(content: string): string {
    return (content ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  private isMicroMessage(content: string): boolean {
    return (content ?? '').trim().length < MessageService.MICRO_MESSAGE_LENGTH;
  }

  private async getRecentSenderMessages(conversationId: string, senderId: string, take = 10) {
    return this.prisma.message.findMany({
      where: {
        conversationId,
        senderId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      select: {
        id: true,
        content: true,
        createdAt: true,
      },
    });
  }

  private async assertNoRecentDuplicateMessage(conversationId: string, senderId: string, content: string) {
    const recentMessages = await this.getRecentSenderMessages(
      conversationId,
      senderId,
      MessageService.DUPLICATE_LOOKBACK,
    );

    const normalizedIncoming = this.normalizeForDuplicateCheck(content);

    const duplicate = recentMessages.some(
      (msg: { content: string }) =>
        this.normalizeForDuplicateCheck(msg.content) === normalizedIncoming,
    );

    if (duplicate) {
      throw new ForbiddenException('Duplicate message blocked');
    }

    return recentMessages;
  }

  private assertMessagingThrottle(recentMessages: Array<{ content: string; createdAt: Date }>, content: string) {
    const now = Date.now();

    const lastMessage = recentMessages[0];
    if (lastMessage) {
      const lastCreatedAt = new Date(lastMessage.createdAt).getTime();
      if (now - lastCreatedAt < MessageService.COOLDOWN_MS) {
        throw new ForbiddenException('Please slow down before sending another message');
      }
    }

    const burstMessages = recentMessages.filter((msg) => {
      const ts = new Date(msg.createdAt).getTime();
      return now - ts <= MessageService.BURST_WINDOW_MS;
    });

    if (burstMessages.length >= MessageService.BURST_MAX_MESSAGES) {
      throw new ForbiddenException('Too many messages sent in a short time');
    }

    const incomingIsMicro = this.isMicroMessage(content);
    if (incomingIsMicro) {
      const recentMicroMessages = burstMessages.filter((msg) => this.isMicroMessage(msg.content));
      if (recentMicroMessages.length >= MessageService.MICRO_BURST_THRESHOLD) {
        throw new ForbiddenException('Too many short messages sent in a row');
      }
    }
  }

  async sendMessage(transactionId: string, requester: Requester, rawContent: string) {
    await this.assertCanAccessTransaction(transactionId, requester);

    const convo = await this.getOrCreateConversation(transactionId);

    const sanitized = this.sanitizer.sanitize(rawContent);

    if (sanitized.status === 'BLOCKED' || !sanitized.content || sanitized.content.length === 0) {
      throw new ForbiddenException(
        'Message blocked because it appears to contain forbidden external contact information',
      );
    }

    const recentMessages = await this.assertNoRecentDuplicateMessage(
      convo.id,
      requester.userId,
      sanitized.content,
    );

    this.assertMessagingThrottle(recentMessages, sanitized.content);

    const msg = await this.prisma.message.create({
      data: {
        conversationId: convo.id,
        senderId: requester.userId,
        content: sanitized.content,
        isRedacted: sanitized.isRedacted,
      },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        content: true,
        isRedacted: true,
        createdAt: true,
      },
    });

    return {
      transactionId,
      conversationId: convo.id,
      moderation: {
        status: sanitized.status,
        reasons: sanitized.reasons,
      },
      message: msg,
    };
  }

  async listMessages(
    transactionId: string,
    requester: Requester,
    opts: { limit?: number; cursor?: string },
  ) {
    await this.assertCanAccessTransaction(transactionId, requester);

    const convo = await this.getOrCreateConversation(transactionId);

    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);

    const messages = await this.prisma.message.findMany({
      where: { conversationId: convo.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      ...(opts.cursor
        ? {
            cursor: { id: opts.cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        senderId: true,
        content: true,
        isRedacted: true,
        createdAt: true,
      },
    });

    const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null;

    return {
      transactionId,
      conversationId: convo.id,
      items: messages,
      nextCursor,
    };
  }
}