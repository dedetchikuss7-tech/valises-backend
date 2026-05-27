import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ProviderEventProcessingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FailedWebhooksQueryDto, WebhookStatsQueryDto } from './dto/webhook-retry.dto';
import { OperationalHealthService } from '../../operational-health/operational-health.service';

// Rate limit: max 10 replays per minute per admin (in-memory, sufficient for alpha)
const replayRateLimiter = new Map<string, { count: number; windowStart: number }>();
const REPLAY_RATE_LIMIT = 10;
const REPLAY_WINDOW_MS = 60_000;

@Injectable()
export class WebhookRetryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationalHealthService: OperationalHealthService,
  ) {}

  async getFailedWebhooks(query: FailedWebhooksQueryDto) {
    const limit = Math.min(query.limit ?? 20, 100);

    const where: Record<string, any> = {
      processingStatus: ProviderEventProcessingStatus.FAILED,
    };

    if (query.provider) {
      where.provider = query.provider;
    }

    const events = await this.prisma.providerEvent.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        eventType: true,
        processingStatus: true,
        failureReason: true,
        createdAt: true,
        // payload intentionally excluded — may contain PSP secrets
      },
    });

    const hasMore = events.length > limit;
    const data = hasMore ? events.slice(0, limit) : events;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return { data, nextCursor, hasMore };
  }

  async replayWebhook(eventId: string, adminId: string) {
    this.checkReplayRateLimit(adminId);

    const event = await this.prisma.providerEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`ProviderEvent ${eventId} not found`);
    }

    if (event.processingStatus !== ProviderEventProcessingStatus.FAILED) {
      throw new BadRequestException(
        `Cannot replay event with status ${event.processingStatus} — only FAILED events can be replayed`,
      );
    }

    // Reset to RECEIVED so the webhook worker picks it up again
    const updated = await this.prisma.providerEvent.update({
      where: { id: eventId },
      data: {
        processingStatus: ProviderEventProcessingStatus.RECEIVED,
      },
      select: {
        id: true,
        provider: true,
        eventType: true,
        processingStatus: true,
      },
    });

    return {
      replayed: true,
      event: updated,
      replayedBy: adminId,
      replayedAt: new Date().toISOString(),
    };
  }

  async getWebhookStats(query: WebhookStatsQueryDto) {
    const days = Math.min(query.days ?? 7, 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const allEvents = await this.prisma.providerEvent.groupBy({
      by: ['provider', 'processingStatus'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
    });

    const providerMap = new Map<
      string,
      { total: number; failed: number }
    >();

    for (const row of allEvents) {
      const existing = providerMap.get(row.provider) ?? { total: 0, failed: 0 };
      existing.total += row._count.id;
      if (row.processingStatus === ProviderEventProcessingStatus.FAILED) {
        existing.failed += row._count.id;
      }
      providerMap.set(row.provider, existing);
    }

    const stats: Record<string, { total: number; failed: number; failureRate: number; alert: boolean }> = {};
    for (const [provider, data] of providerMap.entries()) {
      const failureRate = data.total > 0 ? (data.failed / data.total) * 100 : 0;
      stats[provider] = {
        ...data,
        failureRate: Math.round(failureRate * 10) / 10,
        alert: failureRate > 5,
      };
    }

    const totalAll = Object.values(stats).reduce((s, v) => s + v.total, 0);
    const failedAll = Object.values(stats).reduce((s, v) => s + v.failed, 0);
    const globalFailureRate = totalAll > 0 ? (failedAll / totalAll) * 100 : 0;

    return {
      windowDays: days,
      since: since.toISOString(),
      byProvider: stats,
      global: {
        total: totalAll,
        failed: failedAll,
        failureRate: Math.round(globalFailureRate * 10) / 10,
        alert: globalFailureRate > 5,
      },
    };
  }

  // Exposed for testing only
  __resetRateLimiter() {
    replayRateLimiter.clear();
  }

  private checkReplayRateLimit(adminId: string) {
    const now = Date.now();
    const entry = replayRateLimiter.get(adminId);

    if (!entry || now - entry.windowStart > REPLAY_WINDOW_MS) {
      replayRateLimiter.set(adminId, { count: 1, windowStart: now });
      return;
    }

    if (entry.count >= REPLAY_RATE_LIMIT) {
      throw new BadRequestException(
        `Rate limit exceeded: max ${REPLAY_RATE_LIMIT} replays per minute`,
      );
    }

    entry.count += 1;
  }
}
