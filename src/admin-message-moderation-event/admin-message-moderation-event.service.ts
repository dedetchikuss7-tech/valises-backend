import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListMessageModerationEventsQueryDto } from './dto/list-message-moderation-events.query.dto';

@Injectable()
export class AdminMessageModerationEventService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListMessageModerationEventsQueryDto) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);

    const items = await this.prisma.messageModerationEvent.findMany({
      where: {
        ...(query.transactionId ? { transactionId: query.transactionId } : {}),
        ...(query.senderId ? { senderId: query.senderId } : {}),
        ...(query.kind ? { kind: query.kind as any } : {}),
        ...(query.code ? { code: query.code } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        transactionId: true,
        conversationId: true,
        senderId: true,
        kind: true,
        code: true,
        message: true,
        reasons: true,
        metadata: true,
        createdAt: true,
      },
    });

    return {
      items,
      limit,
      filters: {
        transactionId: query.transactionId ?? null,
        senderId: query.senderId ?? null,
        kind: query.kind ?? null,
        code: query.code ?? null,
      },
    };
  }

  async findOne(id: string) {
    const event = await this.prisma.messageModerationEvent.findUnique({
      where: { id },
      select: {
        id: true,
        transactionId: true,
        conversationId: true,
        senderId: true,
        kind: true,
        code: true,
        message: true,
        reasons: true,
        metadata: true,
        createdAt: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Message moderation event not found');
    }

    return event;
  }
}