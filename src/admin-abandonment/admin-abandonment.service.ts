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
import { CreateReminderJobFromEventDto } from './dto/create-reminder-job-from-event.dto';
import { CreateReminderJobsFromEventsDto } from './dto/create-reminder-jobs-from-events.dto';
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

  async createReminderJobFromAbandonmentEvent(
    id: string,
    body: CreateReminderJobFromEventDto,
  ) {
    const event = await this.findAbandonmentEventOrThrow(id);

    if (event.status !== AbandonmentEventStatus.ACTIVE) {
      throw new ConflictException(
        'Cannot create reminder job for a non-active abandonment event',
      );
    }

    const duplicate = await this.findExactPendingDuplicate(
      event.id,
      body.channel,
      body.scheduledFor,
    );

    if (duplicate) {
      throw new ConflictException(
        'A pending reminder job with the same event, channel, and scheduled time already exists',
      );
    }

    const created = await this.prisma.reminderJob.create({
      data: {
        abandonmentEventId: event.id,
        channel: body.channel,
        scheduledFor: body.scheduledFor,
        status: ReminderJobStatus.PENDING,
        payload: {
          ...(body.payload ?? {}),
          manualAdminCreate: true,
          manualAdminCreatedAt: new Date().toISOString(),
          source: 'admin_abandonment',
          abandonmentKind: event.kind,
        } as Prisma.InputJsonValue,
      },
      include: {
        abandonmentEvent: true,
      },
    });

    return {
      action: 'CREATED',
      item: created,
    };
  }

  async createReminderJobsFromAbandonmentEvents(
    body: CreateReminderJobsFromEventsDto,
  ) {
    const uniqueEventIds = [...new Set(body.eventIds)];
    const created: Array<{
      reminderJobId: string;
      abandonmentEventId: string;
      status: string;
    }> = [];
    const skipped: Array<{
      abandonmentEventId: string;
      reason: string;
    }> = [];

    for (const eventId of uniqueEventIds) {
      const event = await this.prisma.abandonmentEvent.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        skipped.push({
          abandonmentEventId: eventId,
          reason: 'ABANDONMENT_EVENT_NOT_FOUND',
        });
        continue;
      }

      if (event.status !== AbandonmentEventStatus.ACTIVE) {
        skipped.push({
          abandonmentEventId: eventId,
          reason: 'ABANDONMENT_EVENT_NOT_ACTIVE',
        });
        continue;
      }

      const duplicate = await this.findExactPendingDuplicate(
        event.id,
        body.channel,
        body.scheduledFor,
      );

      if (duplicate) {
        skipped.push({
          abandonmentEventId: event.id,
          reason: 'DUPLICATE_PENDING_REMINDER_JOB',
        });
        continue;
      }

      const reminderJob = await this.prisma.reminderJob.create({
        data: {
          abandonmentEventId: event.id,
          channel: body.channel,
          scheduledFor: body.scheduledFor,
          status: ReminderJobStatus.PENDING,
          payload: {
            ...(body.payload ?? {}),
            manualAdminBatchCreate: true,
            manualAdminBatchCreatedAt: new Date().toISOString(),
            source: 'admin_abandonment_batch',
            abandonmentKind: event.kind,
          } as Prisma.InputJsonValue,
        },
      });

      created.push({
        reminderJobId: reminderJob.id,
        abandonmentEventId: reminderJob.abandonmentEventId,
        status: reminderJob.status,
      });
    }

    return {
      action: 'CREATED_BATCH',
      requestedCount: body.eventIds.length,
      uniqueEventIdsCount: uniqueEventIds.length,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    };
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

  async listActionableReminderJobs(query: ListDueReminderJobsQueryDto) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const now = new Date();

    const items = await this.prisma.reminderJob.findMany({
      where: {
        ...(query.channel ? { channel: query.channel as any } : {}),
        abandonmentEvent: {
          status: AbandonmentEventStatus.ACTIVE,
        },
        OR: [
          {
            status: ReminderJobStatus.PENDING,
            scheduledFor: {
              lte: now,
            },
          },
          {
            status: ReminderJobStatus.FAILED,
          },
          {
            status: ReminderJobStatus.CANCELLED,
          },
        ],
      },
      include: {
        abandonmentEvent: true,
      },
      orderBy: [{ scheduledFor: 'asc' }, { updatedAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    const duePending = items.filter(
      (item) =>
        item.status === ReminderJobStatus.PENDING &&
        item.scheduledFor &&
        item.scheduledFor <= now,
    );
    const failed = items.filter((item) => item.status === ReminderJobStatus.FAILED);
    const cancelled = items.filter(
      (item) => item.status === ReminderJobStatus.CANCELLED,
    );

    return {
      items,
      limit,
      serverTime: now.toISOString(),
      summary: {
        duePendingCount: duePending.length,
        failedCount: failed.length,
        cancelledCount: cancelled.length,
        actionableCount: items.length,
      },
      filters: {
        channel: query.channel ?? null,
        abandonmentEventStatus: AbandonmentEventStatus.ACTIVE,
        actionableStatuses: [
          ReminderJobStatus.PENDING,
          ReminderJobStatus.FAILED,
          ReminderJobStatus.CANCELLED,
        ],
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

  async triggerReminderJobs(query: ListReminderJobsQueryDto) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const effectiveStatus = ReminderJobStatus.PENDING;
    const now = new Date();

    const items = await this.prisma.reminderJob.findMany({
      where: {
        ...(query.abandonmentEventId
          ? { abandonmentEventId: query.abandonmentEventId }
          : {}),
        status: effectiveStatus,
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

    for (const job of items) {
      const message = this.buildReminderMessage(job.abandonmentEvent.kind);
      const existingPayload = this.asObject(job.payload);

      await this.prisma.reminderJob.update({
        where: { id: job.id },
        data: {
          status: ReminderJobStatus.SENT,
          sentAt: now,
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
      action: 'TRIGGERED_BATCH',
      processedCount: processed.length,
      limit,
      serverTime: now.toISOString(),
      filters: {
        abandonmentEventId: query.abandonmentEventId ?? null,
        status: effectiveStatus,
        channel: query.channel ?? null,
        abandonmentEventStatus: AbandonmentEventStatus.ACTIVE,
      },
      items: processed,
    };
  }

  async cancelReminderJobs(query: ListReminderJobsQueryDto) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const cancellableStatuses: ReminderJobStatus[] = [
      ReminderJobStatus.PENDING,
      ReminderJobStatus.FAILED,
    ];
    const requestedStatus =
      query.status && cancellableStatuses.includes(query.status as ReminderJobStatus)
        ? (query.status as ReminderJobStatus)
        : null;
    const now = new Date();

    const items = await this.prisma.reminderJob.findMany({
      where: {
        ...(query.abandonmentEventId
          ? { abandonmentEventId: query.abandonmentEventId }
          : {}),
        ...(requestedStatus
          ? { status: requestedStatus }
          : { status: { in: cancellableStatuses } }),
        ...(query.channel ? { channel: query.channel as any } : {}),
        abandonmentEvent: {
          status: AbandonmentEventStatus.ACTIVE,
        },
      },
      include: {
        abandonmentEvent: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    const processed: Array<{
      reminderJobId: string;
      abandonmentEventId: string;
      previousStatus: string;
      status: string;
    }> = [];

    for (const job of items) {
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
        previousStatus: job.status,
        status: ReminderJobStatus.CANCELLED,
      });
    }

    return {
      action: 'CANCELLED_BATCH',
      processedCount: processed.length,
      limit,
      serverTime: now.toISOString(),
      filters: {
        abandonmentEventId: query.abandonmentEventId ?? null,
        status:
          requestedStatus ?? [
            ReminderJobStatus.PENDING,
            ReminderJobStatus.FAILED,
          ],
        channel: query.channel ?? null,
        abandonmentEventStatus: AbandonmentEventStatus.ACTIVE,
      },
      items: processed,
    };
  }

  async retryReminderJobs(query: ListReminderJobsQueryDto) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const retryableStatuses: ReminderJobStatus[] = [
      ReminderJobStatus.FAILED,
      ReminderJobStatus.CANCELLED,
    ];
    const requestedStatus =
      query.status && retryableStatuses.includes(query.status as ReminderJobStatus)
        ? (query.status as ReminderJobStatus)
        : null;
    const now = new Date();

    const items = await this.prisma.reminderJob.findMany({
      where: {
        ...(query.abandonmentEventId
          ? { abandonmentEventId: query.abandonmentEventId }
          : {}),
        ...(requestedStatus
          ? { status: requestedStatus }
          : { status: { in: retryableStatuses } }),
        ...(query.channel ? { channel: query.channel as any } : {}),
        abandonmentEvent: {
          status: AbandonmentEventStatus.ACTIVE,
        },
      },
      include: {
        abandonmentEvent: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    const processed: Array<{
      reminderJobId: string;
      abandonmentEventId: string;
      previousStatus: string;
      status: string;
    }> = [];

    for (const job of items) {
      await this.prisma.reminderJob.update({
        where: { id: job.id },
        data: {
          status: ReminderJobStatus.PENDING,
          scheduledFor: now,
          sentAt: null,
          lastError: null,
        },
      });

      processed.push({
        reminderJobId: job.id,
        abandonmentEventId: job.abandonmentEventId,
        previousStatus: job.status,
        status: ReminderJobStatus.PENDING,
      });
    }

    return {
      action: 'RETRIED_BATCH',
      processedCount: processed.length,
      limit,
      serverTime: now.toISOString(),
      filters: {
        abandonmentEventId: query.abandonmentEventId ?? null,
        status:
          requestedStatus ?? [
            ReminderJobStatus.FAILED,
            ReminderJobStatus.CANCELLED,
          ],
        channel: query.channel ?? null,
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

  private async findAbandonmentEventOrThrow(id: string) {
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

  private async findExactPendingDuplicate(
    abandonmentEventId: string,
    channel: string,
    scheduledFor: Date,
  ) {
    return this.prisma.reminderJob.findFirst({
      where: {
        abandonmentEventId,
        channel: channel as any,
        status: ReminderJobStatus.PENDING,
        scheduledFor,
      },
    });
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