import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminOwnership,
  AdminOwnershipObjectType,
  AdminOwnershipOperationalStatus,
  AdminTimelineObjectType,
  AdminTimelineSeverity,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminActionAuditService } from '../admin-action-audit/admin-action-audit.service';
import { AdminTimelineService } from '../admin-timeline/admin-timeline.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import { ClaimAdminOwnershipDto } from './dto/claim-admin-ownership.dto';
import { ReleaseAdminOwnershipDto } from './dto/release-admin-ownership.dto';
import { UpdateAdminOwnershipStatusDto } from './dto/update-admin-ownership-status.dto';
import { AdminOwnershipResponseDto } from './dto/admin-ownership-response.dto';
import { AdminOwnershipSummaryResponseDto } from './dto/admin-ownership-summary-response.dto';
import {
  AdminOwnershipSortBy,
  ListAdminOwnershipQueryDto,
  SortOrder,
} from './dto/list-admin-ownership-query.dto';

const DUE_SOON_THRESHOLD_MINUTES = 60;

@Injectable()
export class AdminOwnershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminActionAuditService: AdminActionAuditService,
    private readonly adminTimelineService: AdminTimelineService,
  ) {}

  async claim(
    actorAdminId: string,
    dto: ClaimAdminOwnershipDto,
  ): Promise<AdminOwnershipResponseDto> {
    const existing = await this.findRaw(dto.objectType, dto.objectId);
    const now = new Date();

    if (
      existing &&
      this.isActivelyOwned(existing.operationalStatus) &&
      existing.assignedAdminId &&
      existing.assignedAdminId !== actorAdminId
    ) {
      throw new ConflictException(
        'This admin object is already claimed by another admin',
      );
    }

    const slaDueAt = dto.slaDueAt
      ? new Date(dto.slaDueAt)
      : existing?.slaDueAt ?? null;

    const item = existing
      ? await this.prisma.adminOwnership.update({
          where: {
            objectType_objectId: {
              objectType: dto.objectType,
              objectId: dto.objectId,
            },
          },
          data: {
            assignedAdminId: actorAdminId,
            claimedAt: existing.claimedAt ?? now,
            releasedAt: null,
            completedAt: null,
            operationalStatus: AdminOwnershipOperationalStatus.CLAIMED,
            slaDueAt,
            metadata: this.mergeMetadata(existing.metadata, {
              lastClaimNote: dto.note ?? null,
              lastClaimedBy: actorAdminId,
              lastClaimedAt: now.toISOString(),
            }),
          },
        })
      : await this.prisma.adminOwnership.create({
          data: {
            objectType: dto.objectType,
            objectId: dto.objectId,
            assignedAdminId: actorAdminId,
            claimedAt: now,
            operationalStatus: AdminOwnershipOperationalStatus.CLAIMED,
            slaDueAt,
            metadata: this.mergeMetadata(null, {
              lastClaimNote: dto.note ?? null,
              lastClaimedBy: actorAdminId,
              lastClaimedAt: now.toISOString(),
            }),
          },
        });

    await this.adminActionAuditService.recordSafe({
      action: 'ADMIN_OWNERSHIP_CLAIM',
      targetType: dto.objectType,
      targetId: dto.objectId,
      actorUserId: actorAdminId,
      metadata: {
        note: dto.note ?? null,
        slaDueAt: slaDueAt?.toISOString() ?? null,
      },
    });

    await this.adminTimelineService.recordSafe({
      objectType: this.toTimelineObjectType(dto.objectType),
      objectId: dto.objectId,
      eventType: 'ADMIN_OWNERSHIP_CLAIMED',
      title: 'Ownership claimed',
      message: `Admin ${actorAdminId} claimed ${dto.objectType} ${dto.objectId}.`,
      actorUserId: actorAdminId,
      severity: AdminTimelineSeverity.INFO,
      metadata: {
        note: dto.note ?? null,
        slaDueAt: slaDueAt?.toISOString() ?? null,
        assignedAdminId: actorAdminId,
      },
    });

    return this.toResponse(item);
  }

  async release(
    actorAdminId: string,
    dto: ReleaseAdminOwnershipDto,
  ): Promise<AdminOwnershipResponseDto> {
    const existing = await this.findRaw(dto.objectType, dto.objectId);

    if (!existing) {
      throw new NotFoundException('Admin ownership item not found');
    }

    const now = new Date();

    const item = await this.prisma.adminOwnership.update({
      where: {
        objectType_objectId: {
          objectType: dto.objectType,
          objectId: dto.objectId,
        },
      },
      data: {
        assignedAdminId: null,
        releasedAt: now,
        operationalStatus: AdminOwnershipOperationalStatus.RELEASED,
        metadata: this.mergeMetadata(existing.metadata, {
          lastReleaseNote: dto.note ?? null,
          lastReleasedBy: actorAdminId,
          lastReleasedAt: now.toISOString(),
        }),
      },
    });

    await this.adminActionAuditService.recordSafe({
      action: 'ADMIN_OWNERSHIP_RELEASE',
      targetType: dto.objectType,
      targetId: dto.objectId,
      actorUserId: actorAdminId,
      metadata: {
        note: dto.note ?? null,
      },
    });

    await this.adminTimelineService.recordSafe({
      objectType: this.toTimelineObjectType(dto.objectType),
      objectId: dto.objectId,
      eventType: 'ADMIN_OWNERSHIP_RELEASED',
      title: 'Ownership released',
      message: `Admin ${actorAdminId} released ${dto.objectType} ${dto.objectId}.`,
      actorUserId: actorAdminId,
      severity: AdminTimelineSeverity.INFO,
      metadata: {
        note: dto.note ?? null,
        previousAssignedAdminId: existing.assignedAdminId,
      },
    });

    return this.toResponse(item);
  }

  async updateStatus(
    actorAdminId: string,
    dto: UpdateAdminOwnershipStatusDto,
  ): Promise<AdminOwnershipResponseDto> {
    const existing = await this.findRaw(dto.objectType, dto.objectId);

    if (!existing) {
      throw new NotFoundException('Admin ownership item not found');
    }

    const now = new Date();
    const status = dto.operationalStatus;

    const data: Prisma.AdminOwnershipUpdateInput = {
      operationalStatus: status,
      metadata: this.mergeMetadata(existing.metadata, {
        lastStatusUpdateNote: dto.note ?? null,
        lastStatusUpdatedBy: actorAdminId,
        lastStatusUpdatedAt: now.toISOString(),
        previousOperationalStatus: existing.operationalStatus,
        newOperationalStatus: status,
      }),
    };

    if (dto.slaDueAt) {
      data.slaDueAt = new Date(dto.slaDueAt);
    }

    if (
      status === AdminOwnershipOperationalStatus.IN_REVIEW ||
      status === AdminOwnershipOperationalStatus.WAITING_EXTERNAL ||
      status === AdminOwnershipOperationalStatus.CLAIMED
    ) {
      data.assignedAdminId = existing.assignedAdminId ?? actorAdminId;
      data.claimedAt = existing.claimedAt ?? now;
      data.releasedAt = null;
      data.completedAt = null;
    }

    if (status === AdminOwnershipOperationalStatus.DONE) {
      data.completedAt = now;
    }

    if (status === AdminOwnershipOperationalStatus.RELEASED) {
      data.assignedAdminId = null;
      data.releasedAt = now;
    }

    const item = await this.prisma.adminOwnership.update({
      where: {
        objectType_objectId: {
          objectType: dto.objectType,
          objectId: dto.objectId,
        },
      },
      data,
    });

    await this.adminActionAuditService.recordSafe({
      action: 'ADMIN_OWNERSHIP_STATUS_UPDATE',
      targetType: dto.objectType,
      targetId: dto.objectId,
      actorUserId: actorAdminId,
      metadata: {
        previousOperationalStatus: existing.operationalStatus,
        newOperationalStatus: status,
        note: dto.note ?? null,
        slaDueAt: dto.slaDueAt ?? null,
      },
    });

    await this.adminTimelineService.recordSafe({
      objectType: this.toTimelineObjectType(dto.objectType),
      objectId: dto.objectId,
      eventType: 'ADMIN_OWNERSHIP_STATUS_UPDATED',
      title: 'Ownership status updated',
      message: `Admin ${actorAdminId} changed ${dto.objectType} ${dto.objectId} from ${existing.operationalStatus} to ${status}.`,
      actorUserId: actorAdminId,
      severity:
        status === AdminOwnershipOperationalStatus.DONE
          ? AdminTimelineSeverity.SUCCESS
          : AdminTimelineSeverity.INFO,
      metadata: {
        note: dto.note ?? null,
        previousOperationalStatus: existing.operationalStatus,
        newOperationalStatus: status,
        slaDueAt: dto.slaDueAt ?? null,
      },
    });

    return this.toResponse(item);
  }

  async getOne(
    objectType: AdminOwnershipObjectType,
    objectId: string,
  ): Promise<AdminOwnershipResponseDto> {
    const item = await this.findRaw(objectType, objectId);

    if (!item) {
      throw new NotFoundException('Admin ownership item not found');
    }

    return this.toResponse(item);
  }

  async list(
    query: ListAdminOwnershipQueryDto,
  ): Promise<PaginatedListResponseDto<AdminOwnershipResponseDto>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const where: Prisma.AdminOwnershipWhereInput = {
      ...(query.objectType ? { objectType: query.objectType } : {}),
      ...(query.operationalStatus
        ? { operationalStatus: query.operationalStatus }
        : {}),
      ...(query.assignedAdminId
        ? { assignedAdminId: query.assignedAdminId }
        : {}),
    };

    const rawItems = await this.prisma.adminOwnership.findMany({
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
          item.objectId.toLowerCase().includes(q) ||
          item.objectType.toLowerCase().includes(q) ||
          item.operationalStatus.toLowerCase().includes(q) ||
          (item.assignedAdminId ?? '').toLowerCase().includes(q) ||
          metadata.includes(q)
        );
      });
    }

    if (query.onlyOverdue !== undefined) {
      items = items.filter((item) => item.isOverdue === query.onlyOverdue);
    }

    if (query.onlyDueSoon !== undefined) {
      items = items.filter((item) => item.isDueSoon === query.onlyDueSoon);
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

  async getSummary(): Promise<AdminOwnershipSummaryResponseDto> {
    const rows = await this.prisma.adminOwnership.findMany({
      take: 1000,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });

    const items = rows.map((row) => this.toResponse(row));

    return {
      generatedAt: new Date(),
      totalRows: items.length,
      unassignedRows: items.filter((item) => !item.assignedAdminId).length,
      claimedRows: items.filter(
        (item) =>
          item.operationalStatus === AdminOwnershipOperationalStatus.CLAIMED,
      ).length,
      inReviewRows: items.filter(
        (item) =>
          item.operationalStatus === AdminOwnershipOperationalStatus.IN_REVIEW,
      ).length,
      waitingExternalRows: items.filter(
        (item) =>
          item.operationalStatus ===
          AdminOwnershipOperationalStatus.WAITING_EXTERNAL,
      ).length,
      doneRows: items.filter(
        (item) =>
          item.operationalStatus === AdminOwnershipOperationalStatus.DONE,
      ).length,
      releasedRows: items.filter(
        (item) =>
          item.operationalStatus === AdminOwnershipOperationalStatus.RELEASED,
      ).length,
      overdueRows: items.filter((item) => item.isOverdue).length,
      dueSoonRows: items.filter((item) => item.isDueSoon).length,
    };
  }

  private async findRaw(
    objectType: AdminOwnershipObjectType,
    objectId: string,
  ): Promise<AdminOwnership | null> {
    return this.prisma.adminOwnership.findUnique({
      where: {
        objectType_objectId: {
          objectType,
          objectId,
        },
      },
    });
  }

  private isActivelyOwned(status: AdminOwnershipOperationalStatus): boolean {
    const activelyOwnedStatuses: AdminOwnershipOperationalStatus[] = [
      AdminOwnershipOperationalStatus.CLAIMED,
      AdminOwnershipOperationalStatus.IN_REVIEW,
      AdminOwnershipOperationalStatus.WAITING_EXTERNAL,
    ];

    return activelyOwnedStatuses.includes(status);
  }

  private toTimelineObjectType(
    objectType: AdminOwnershipObjectType,
  ): AdminTimelineObjectType {
    return objectType as unknown as AdminTimelineObjectType;
  }

  private toResponse(item: AdminOwnership): AdminOwnershipResponseDto {
    const now = new Date();
    const createdAt = item.createdAt;
    const ageMinutes = Math.max(
      0,
      Math.floor((now.getTime() - createdAt.getTime()) / 60_000),
    );

    const timeToSlaMinutes = item.slaDueAt
      ? Math.ceil((item.slaDueAt.getTime() - now.getTime()) / 60_000)
      : null;

    const isTerminal =
      item.operationalStatus === AdminOwnershipOperationalStatus.DONE ||
      item.operationalStatus === AdminOwnershipOperationalStatus.RELEASED;

    const isOverdue =
      !isTerminal && timeToSlaMinutes !== null && timeToSlaMinutes < 0;

    const isDueSoon =
      !isTerminal &&
      timeToSlaMinutes !== null &&
      timeToSlaMinutes >= 0 &&
      timeToSlaMinutes <= DUE_SOON_THRESHOLD_MINUTES;

    return {
      id: item.id,
      objectType: item.objectType,
      objectId: item.objectId,
      assignedAdminId: item.assignedAdminId,
      claimedAt: item.claimedAt,
      releasedAt: item.releasedAt,
      operationalStatus: item.operationalStatus,
      slaDueAt: item.slaDueAt,
      completedAt: item.completedAt,
      metadata: this.asRecord(item.metadata),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      ageMinutes,
      isOverdue,
      isDueSoon,
      timeToSlaMinutes,
    };
  }

  private toOrderBy(
    sortBy?: AdminOwnershipSortBy,
    sortOrder?: SortOrder,
  ): Prisma.AdminOwnershipOrderByWithRelationInput[] {
    const direction = sortOrder === SortOrder.ASC ? 'asc' : 'desc';

    switch (sortBy) {
      case AdminOwnershipSortBy.CREATED_AT:
        return [{ createdAt: direction }, { id: 'desc' }];

      case AdminOwnershipSortBy.SLA_DUE_AT:
        return [{ slaDueAt: direction }, { updatedAt: 'desc' }, { id: 'desc' }];

      case AdminOwnershipSortBy.STATUS:
        return [
          { operationalStatus: direction },
          { updatedAt: 'desc' },
          { id: 'desc' },
        ];

      case AdminOwnershipSortBy.OBJECT_TYPE:
        return [
          { objectType: direction },
          { updatedAt: 'desc' },
          { id: 'desc' },
        ];

      case AdminOwnershipSortBy.UPDATED_AT:
      default:
        return [{ updatedAt: direction }, { id: 'desc' }];
    }
  }

  private mergeMetadata(
    existing: Prisma.JsonValue | null,
    patch: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    return {
      ...(this.asRecord(existing) ?? {}),
      ...patch,
    } as Prisma.InputJsonObject;
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