import { Injectable, NotFoundException } from '@nestjs/common';
import { ListAbandonmentEventsQueryDto } from './dto/list-abandonment-events.query.dto';
import { ListReminderJobsQueryDto } from './dto/list-reminder-jobs.query.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminAbandonmentService {
  constructor(private readonly prisma: PrismaService) {}

  async listAbandonmentEvents(query: ListAbandonmentEventsQueryDto) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);

    const items = await this.prisma.abandonmentEvent.findMany({
      where: {
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.kind ? { kind: query.kind as any } : {}),
        ...(query.status ? { status: query.status as any } : {}),
      },
      include: {
        reminderJobs: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    return {
      items,
      limit,
      filters: {
        userId: query.userId ?? null,
        kind: query.kind ?? null,
        status: query.status ?? null,
      },
    };
  }

  async findAbandonmentEvent(id: string) {
    const event = await this.prisma.abandonmentEvent.findUnique({
      where: { id },
      include: {
        reminderJobs: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Abandonment event not found');
    }

    return event;
  }

  async listReminderJobs(query: ListReminderJobsQueryDto) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);

    const items = await this.prisma.reminderJob.findMany({
      where: {
        ...(query.abandonmentEventId
          ? { abandonmentEventId: query.abandonmentEventId }
          : {}),
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.channel ? { channel: query.channel as any } : {}),
      },
      include: {
        abandonmentEvent: true,
      },
      orderBy: [{ scheduledFor: 'asc' }, { id: 'desc' }],
      take: limit,
    });

    return {
      items,
      limit,
      filters: {
        abandonmentEventId: query.abandonmentEventId ?? null,
        status: query.status ?? null,
        channel: query.channel ?? null,
      },
    };
  }
}