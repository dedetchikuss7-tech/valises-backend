import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AbandonmentEventStatus,
  AbandonmentKind,
  Prisma,
  ReminderJobStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListAbandonmentEventsQueryDto } from './dto/list-abandonment-events.query.dto';
import { ListReminderJobsQueryDto } from './dto/list-reminder-jobs.query.dto';
import { ListDueReminderJobsQueryDto } from './dto/list-due-reminder-jobs.query.dto';

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

  async listDueReminderJobs(query: ListDueReminderJobsQueryDto) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const now = new Date();

    const items = await this.prisma.reminderJob.findMany({
      where: {
        status: ReminderJobStatus.PENDING,
        scheduledFor: {
          lte: now,
        },
        ...(query.channel ? { channel: query.channel as any } : {}),
        abandonmentEvent: {
          status: AbandonmentEventStatus.ACTIVE,
        },
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
      serverTime: now.toISOString(),
      filters: {
        channel: query.channel ?? null,
        dueOnly: true,
        status: ReminderJobStatus.PENDING,
        abandonmentEventStatus: AbandonmentEventStatus.ACTIVE,
      },
    };
  }

  async triggerDueReminderJobs(query: ListDueReminderJobsQueryDto) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const now = new Date();

    const dueJobs = await this.prisma.reminderJob.findMany({
      where: {
        status: ReminderJobStatus.PENDING,
        scheduledFor: {
          lte: now,
        },
        ...(query.channel ? { channel: query.channel as any } : {}),
        abandonmentEvent: {
          status: AbandonmentEventStatus.ACTIVE,
        },
      },
      include: {
        abandonmentEvent: true,
      },
      orderBy: [{ scheduledFor: 'asc' }, { id: 'desc' }],
      take: limit,
    });

    const processed: Array<{
      reminderJobId: string;
      abandonmentEventId: string;
      message: string;
      status: string;
    }> = [];

    for (const job of dueJobs) {
      const message = this.buildReminderMessage(job.abandonmentEvent.kind);
      const existingPayload = this.asObject(job.payload);

      await this.prisma.reminderJob.update({
        where: { id: job.id },
        data: {
          status: ReminderJobStatus.SENT,
          sentAt: new Date(),
          lastError: null,
          attemptCount: { increment: 1 },
          payload: {
            ...existingPayload,
            renderedMessage: message,
            manualBatchTrigger: true,
            manualBatchTriggeredAt: now.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });

      processed.push({
        reminderJobId: job.id,
        abandonmentEventId: job.abandonmentEventId,
        message,
        status: ReminderJobStatus.SENT,
      });
    }

    return {
      action: 'TRIGGERED_DUE_BATCH',
      processedCount: processed.length,
      limit,
      serverTime: now.toISOString(),
      filters: {
        channel: query.channel ?? null,
        dueOnly: true,
        status: ReminderJobStatus.PENDING,
        abandonmentEventStatus: AbandonmentEventStatus.ACTIVE,
      },
      items: processed,
    };
  }

  async cancelDueReminderJobs(query: ListDueReminderJobsQueryDto) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const now = new Date();

    const dueJobs = await this.prisma.reminderJob.findMany({
      where: {
        status: ReminderJobStatus.PENDING,
        scheduledFor: {
          lte: now,
        },
        ...(query.channel ? { channel: query.channel as any } : {}),
        abandonmentEvent: {
          status: AbandonmentEventStatus.ACTIVE,
        },
      },
      include: {
        abandonmentEvent: true,
      },
      orderBy: [{ scheduledFor: 'asc' }, { id: 'desc' }],
      take: limit,
    });

    const processed: Array<{
      reminderJobId: string;
      abandonmentEventId: string;
      status: string;
    }> = [];

    for (const job of dueJobs) {
      await this.prisma.reminderJob.update({
        where: { id: job.id },
        data: {
          status: ReminderJobStatus.CANCELLED,
          lastError: null,
        },
      });

      processed.push({
        reminderJobId: job.id,
        abandonmentEventId: job.abandonmentEventId,
        status: ReminderJobStatus.CANCELLED,
      });
    }

    return {
      action: 'CANCELLED_DUE_BATCH',
      processedCount: processed.length,
      limit,
      serverTime: now.toISOString(),
      filters: {
        channel: query.channel ?? null,
        dueOnly: true,
        status: ReminderJobStatus.PENDING,
        abandonmentEventStatus: AbandonmentEventStatus.ACTIVE,
      },
      items: processed,
    };
  }

  async triggerReminderJob(id: string) {
    const job = await this.findReminderJobOrThrow(id);

    if (job.abandonmentEvent.status !== AbandonmentEventStatus.ACTIVE) {
      throw new ConflictException(
        'Cannot trigger reminder job for a non-active abandonment event',
      );
    }

    if (
      job.status !== ReminderJobStatus.PENDING &&
      job.status !== ReminderJobStatus.FAILED
    ) {
      throw new ConflictException(
        'Only pending or failed reminder jobs can be triggered manually',
      );
    }

    const now = new Date();
    const message = this.buildReminderMessage(job.abandonmentEvent.kind);
    const existingPayload = this.asObject(job.payload);

    const updated = await this.prisma.reminderJob.update({
      where: { id: job.id },
      data: {
        status: ReminderJobStatus.SENT,
        sentAt: now,
        lastError: null,
        attemptCount: { increment: 1 },
        payload: {
          ...existingPayload,
          renderedMessage: message,
          manualTrigger: true,
          manualTriggeredAt: now.toISOString(),
        } as Prisma.InputJsonValue,
      },
      include: {
        abandonmentEvent: true,
      },
    });

    return {
      action: 'TRIGGERED',
      item: updated,
    };
  }

  async cancelReminderJob(id: string) {
    const job = await this.findReminderJobOrThrow(id);

    if (
      job.status !== ReminderJobStatus.PENDING &&
      job.status !== ReminderJobStatus.FAILED
    ) {
      throw new ConflictException(
        'Only pending or failed reminder jobs can be cancelled',
      );
    }

    const updated = await this.prisma.reminderJob.update({
      where: { id: job.id },
      data: {
        status: ReminderJobStatus.CANCELLED,
      },
      include: {
        abandonmentEvent: true,
      },
    });

    return {
      action: 'CANCELLED',
      item: updated,
    };
  }

  async retryReminderJob(id: string) {
    const job = await this.findReminderJobOrThrow(id);

    if (job.abandonmentEvent.status !== AbandonmentEventStatus.ACTIVE) {
      throw new ConflictException(
        'Cannot retry reminder job for a non-active abandonment event',
      );
    }

    if (
      job.status !== ReminderJobStatus.FAILED &&
      job.status !== ReminderJobStatus.CANCELLED
    ) {
      throw new ConflictException(
        'Only failed or cancelled reminder jobs can be retried',
      );
    }

    const now = new Date();

    const updated = await this.prisma.reminderJob.update({
      where: { id: job.id },
      data: {
        status: ReminderJobStatus.PENDING,
        scheduledFor: now,
        sentAt: null,
        lastError: null,
      },
      include: {
        abandonmentEvent: true,
      },
    });

    return {
      action: 'REQUEUED',
      item: updated,
    };
  }

  private async findReminderJobOrThrow(id: string) {
    const job = await this.prisma.reminderJob.findUnique({
      where: { id },
      include: {
        abandonmentEvent: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Reminder job not found');
    }

    return job;
  }

  private asObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private buildReminderMessage(kind: AbandonmentKind) {
    switch (kind) {
      case AbandonmentKind.TRIP_DRAFT:
        return 'Your trip draft is still incomplete. Complete it to publish your trip.';
      case AbandonmentKind.PACKAGE_DRAFT:
        return 'Your package draft is still incomplete. Complete it to publish your package.';
      case AbandonmentKind.KYC_PENDING:
        return 'Your KYC is still pending. Complete verification to continue.';
      case AbandonmentKind.PAYMENT_PENDING:
        return 'Your payment is still pending. Complete payment to continue the transaction.';
      default:
        return 'You have an unfinished action on Valises. Please come back and complete it.';
    }
  }
}