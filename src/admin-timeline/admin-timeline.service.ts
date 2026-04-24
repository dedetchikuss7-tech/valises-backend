import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AdminTimelineEvent,
  AdminTimelineObjectType,
  AdminTimelineSeverity,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import { CreateAdminTimelineEventDto } from './dto/create-admin-timeline-event.dto';
import { AdminTimelineEventResponseDto } from './dto/admin-timeline-event-response.dto';
import {
  AdminTimelineSortBy,
  ListAdminTimelineEventsQueryDto,
  SortOrder,
} from './dto/list-admin-timeline-events-query.dto';

type RecordAdminTimelineEventInput = {
  objectType: AdminTimelineObjectType;
  objectId: string;
  eventType: string;
  title: string;
  message?: string | null;
  actorUserId?: string | null;
  severity?: AdminTimelineSeverity;
  metadata?: Record<string, unknown> | null;
};

@Injectable()
export class AdminTimelineService {
  private readonly logger = new Logger(AdminTimelineService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createManualEvent(
    actorAdminId: string,
    dto: CreateAdminTimelineEventDto,
  ): Promise<AdminTimelineEventResponseDto> {
    return this.record({
      objectType: dto.objectType,
      objectId: dto.objectId,
      eventType: dto.eventType,
      title: dto.title,
      message: dto.message ?? null,
      actorUserId: actorAdminId,
      severity: dto.severity ?? AdminTimelineSeverity.INFO,
      metadata: dto.metadata ?? null,
    });
  }

  async record(
    input: RecordAdminTimelineEventInput,
  ): Promise<AdminTimelineEventResponseDto> {
    const item = await this.prisma.adminTimelineEvent.create({
      data: {
        objectType: input.objectType,
        objectId: input.objectId,
        eventType: input.eventType,
        title: input.title,
        message: input.message ?? null,
        actorUserId: input.actorUserId ?? null,
        severity: input.severity ?? AdminTimelineSeverity.INFO,
        metadata: this.toInputJson(input.metadata),
      },
    });

    return this.toResponse(item);
  }

  async recordSafe(input: RecordAdminTimelineEventInput): Promise<void> {
    try {
      await this.record(input);
    } catch (error) {
      this.logger.error(
        `Failed to record admin timeline event: ${input.eventType} ${input.objectType}:${input.objectId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async list(
    query: ListAdminTimelineEventsQueryDto,
  ): Promise<PaginatedListResponseDto<AdminTimelineEventResponseDto>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const where: Prisma.AdminTimelineEventWhereInput = {
      ...(query.objectType ? { objectType: query.objectType } : {}),
      ...(query.objectId ? { objectId: query.objectId } : {}),
      ...(query.eventType ? { eventType: query.eventType } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
    };

    const rawItems = await this.prisma.adminTimelineEvent.findMany({
      where,
      orderBy: this.toOrderBy(query.sortBy, query.sortOrder),
      take: 1000,
    });

    let items = rawItems.map((item) => this.toResponse(item));

    if (query.q) {
      const q = query.q.toLowerCase();

      items = items.filter((item) => {
        const metadata = item.metadata
          ? JSON.stringify(item.metadata).toLowerCase()
          : '';

        return (
          item.objectType.toLowerCase().includes(q) ||
          item.objectId.toLowerCase().includes(q) ||
          item.eventType.toLowerCase().includes(q) ||
          item.title.toLowerCase().includes(q) ||
          (item.message ?? '').toLowerCase().includes(q) ||
          (item.actorUserId ?? '').toLowerCase().includes(q) ||
          metadata.includes(q)
        );
      });
    }

    const total = items.length;
    const paginatedItems = items.slice(offset, offset + limit);

    return {
      items: paginatedItems,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async listForObject(
    objectType: AdminTimelineObjectType,
    objectId: string,
    query: ListAdminTimelineEventsQueryDto,
  ): Promise<PaginatedListResponseDto<AdminTimelineEventResponseDto>> {
    return this.list({
      ...query,
      objectType,
      objectId,
    });
  }

  async getOne(id: string): Promise<AdminTimelineEventResponseDto> {
    const item = await this.prisma.adminTimelineEvent.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('Admin timeline event not found');
    }

    return this.toResponse(item);
  }

  private toResponse(item: AdminTimelineEvent): AdminTimelineEventResponseDto {
    return {
      id: item.id,
      objectType: item.objectType,
      objectId: item.objectId,
      eventType: item.eventType,
      title: item.title,
      message: item.message,
      actorUserId: item.actorUserId,
      severity: item.severity,
      metadata: this.asRecord(item.metadata),
      createdAt: item.createdAt,
    };
  }

  private toOrderBy(
    sortBy?: AdminTimelineSortBy,
    sortOrder?: SortOrder,
  ): Prisma.AdminTimelineEventOrderByWithRelationInput[] {
    const direction = sortOrder === SortOrder.ASC ? 'asc' : 'desc';

    switch (sortBy) {
      case AdminTimelineSortBy.OBJECT_TYPE:
        return [
          { objectType: direction },
          { createdAt: 'desc' },
          { id: 'desc' },
        ];

      case AdminTimelineSortBy.EVENT_TYPE:
        return [
          { eventType: direction },
          { createdAt: 'desc' },
          { id: 'desc' },
        ];

      case AdminTimelineSortBy.SEVERITY:
        return [
          { severity: direction },
          { createdAt: 'desc' },
          { id: 'desc' },
        ];

      case AdminTimelineSortBy.CREATED_AT:
      default:
        return [{ createdAt: direction }, { id: 'desc' }];
    }
  }

  private toInputJson(
    value: Record<string, unknown> | null | undefined,
  ): Prisma.InputJsonValue | undefined {
    if (!value) {
      return undefined;
    }

    return value as Prisma.InputJsonObject;
  }

  private asRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    if (!value) {
      return null;
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      return { value };
    }

    return value as Record<string, unknown>;
  }
}