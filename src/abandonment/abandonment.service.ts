import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AbandonmentEventStatus,
  AbandonmentKind,
  Prisma,
  ReminderJobStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Requester = {
  userId: string;
  role: Role | string;
};

type MarkAbandonedInput = {
  kind: AbandonmentKind;
  tripId?: string;
  packageId?: string;
  transactionId?: string;
  metadata?: Record<string, unknown>;
};

type ResolveActiveByReferenceInput = {
  userId: string;
  kind: AbandonmentKind;
  tripId?: string;
  packageId?: string;
  transactionId?: string;
};

@Injectable()
export class AbandonmentService {
  constructor(private readonly prisma: PrismaService) {}

  private isUserScopedKind(kind: AbandonmentKind): boolean {
    return kind === AbandonmentKind.KYC_PENDING;
  }

  private ensureReferencePolicy(input: {
    kind: AbandonmentKind;
    tripId?: string;
    packageId?: string;
    transactionId?: string;
  }) {
    const hasReference = !!input.tripId || !!input.packageId || !!input.transactionId;

    if (this.isUserScopedKind(input.kind)) {
      return;
    }

    if (!hasReference) {
      throw new ForbiddenException(
        'At least one entity reference is required (tripId, packageId, or transactionId)',
      );
    }
  }

  private toJsonValue(
    value?: Record<string, unknown>,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }

    return value as Prisma.InputJsonValue;
  }

  async markAbandoned(requester: Requester, dto: MarkAbandonedInput) {
    this.ensureReferencePolicy(dto);

    const metadataJson = this.toJsonValue(dto.metadata);

    const existing = await this.prisma.abandonmentEvent.findFirst({
      where: {
        userId: requester.userId,
        kind: dto.kind,
        status: AbandonmentEventStatus.ACTIVE,
        tripId: dto.tripId ?? null,
        packageId: dto.packageId ?? null,
        transactionId: dto.transactionId ?? null,
      },
      include: {
        reminderJobs: true,
      },
    });

    if (existing) {
      return this.prisma.abandonmentEvent.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          metadata: metadataJson,
        },
        include: {
          reminderJobs: true,
        },
      });
    }

    return this.prisma.abandonmentEvent.create({
      data: {
        userId: requester.userId,
        kind: dto.kind,
        tripId: dto.tripId,
        packageId: dto.packageId,
        transactionId: dto.transactionId,
        metadata: metadataJson,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        abandonedAt: new Date(),
        reminderJobs: {
          create: [
            {
              scheduledFor: new Date(Date.now() + 30 * 60 * 1000),
              payload: {
                template: 'abandonment_reminder_30m',
                kind: dto.kind,
              } as Prisma.InputJsonValue,
            },
            {
              scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
              payload: {
                template: 'abandonment_reminder_24h',
                kind: dto.kind,
              } as Prisma.InputJsonValue,
            },
          ],
        },
      },
      include: {
        reminderJobs: true,
      },
    });
  }

  async resolveAbandoned(requester: Requester, dto: { eventId: string }) {
    const event = await this.prisma.abandonmentEvent.findUnique({
      where: { id: dto.eventId },
      include: {
        reminderJobs: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Abandonment event not found');
    }

    const isAdmin = requester.role === Role.ADMIN || requester.role === 'ADMIN';
    const isOwner = event.userId === requester.userId;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('Not allowed');
    }

    await this.prisma.abandonmentEvent.update({
      where: { id: event.id },
      data: {
        status: AbandonmentEventStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });

    await this.prisma.reminderJob.updateMany({
      where: {
        abandonmentEventId: event.id,
        status: ReminderJobStatus.PENDING,
      },
      data: {
        status: ReminderJobStatus.CANCELLED,
      },
    });

    return this.prisma.abandonmentEvent.findUnique({
      where: { id: event.id },
      include: {
        reminderJobs: true,
      },
    });
  }

  async resolveActiveByReference(input: ResolveActiveByReferenceInput) {
    this.ensureReferencePolicy(input);

    const events = await this.prisma.abandonmentEvent.findMany({
      where: {
        userId: input.userId,
        kind: input.kind,
        status: AbandonmentEventStatus.ACTIVE,
        tripId: input.tripId ?? null,
        packageId: input.packageId ?? null,
        transactionId: input.transactionId ?? null,
      },
      select: {
        id: true,
      },
    });

    if (events.length === 0) {
      return {
        resolvedCount: 0,
      };
    }

    const ids = events.map((e) => e.id);

    await this.prisma.abandonmentEvent.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        status: AbandonmentEventStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });

    await this.prisma.reminderJob.updateMany({
      where: {
        abandonmentEventId: { in: ids },
        status: ReminderJobStatus.PENDING,
      },
      data: {
        status: ReminderJobStatus.CANCELLED,
      },
    });

    return {
      resolvedCount: ids.length,
    };
  }

  async listMyEvents(requester: Requester) {
    return this.prisma.abandonmentEvent.findMany({
      where: {
        userId: requester.userId,
      },
      include: {
        reminderJobs: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async processDueReminders(requester: Requester, limit = 20) {
    const isAdmin = requester.role === Role.ADMIN || requester.role === 'ADMIN';

    if (!isAdmin) {
      throw new ForbiddenException('Admin only');
    }

    const dueJobs = await this.prisma.reminderJob.findMany({
      where: {
        status: ReminderJobStatus.PENDING,
        scheduledFor: {
          lte: new Date(),
        },
        abandonmentEvent: {
          status: AbandonmentEventStatus.ACTIVE,
        },
      },
      include: {
        abandonmentEvent: true,
      },
      orderBy: {
        scheduledFor: 'asc',
      },
      take: Math.min(Math.max(limit, 1), 100),
    });

    const processed: Array<{
      reminderJobId: string;
      abandonmentEventId: string;
      message: string;
      status: string;
    }> = [];

    for (const job of dueJobs) {
      const message = this.buildReminderMessage(job.abandonmentEvent.kind);

      const existingPayload =
        job.payload && typeof job.payload === 'object' && !Array.isArray(job.payload)
          ? (job.payload as Record<string, unknown>)
          : {};

      await this.prisma.reminderJob.update({
        where: { id: job.id },
        data: {
          status: ReminderJobStatus.SENT,
          sentAt: new Date(),
          attemptCount: { increment: 1 },
          payload: {
            ...existingPayload,
            renderedMessage: message,
          } as Prisma.InputJsonValue,
        },
      });

      processed.push({
        reminderJobId: job.id,
        abandonmentEventId: job.abandonmentEventId,
        message,
        status: 'SENT',
      });
    }

    return {
      processedCount: processed.length,
      items: processed,
    };
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