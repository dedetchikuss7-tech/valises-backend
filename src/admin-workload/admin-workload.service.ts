import { Injectable } from '@nestjs/common';
import {
  AdminOwnership,
  AdminOwnershipObjectType,
  AdminOwnershipOperationalStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOwnershipService } from '../admin-ownership/admin-ownership.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import { AdminWorkloadItemResponseDto } from './dto/admin-workload-item-response.dto';
import { AdminWorkloadSummaryResponseDto } from './dto/admin-workload-summary-response.dto';
import {
  AdminWorkloadAssigneeListResponseDto,
  AdminWorkloadAssigneeResponseDto,
} from './dto/admin-workload-assignee-response.dto';
import {
  AdminWorkloadQueuePreset,
  AdminWorkloadSortBy,
  ListAdminWorkloadQueueQueryDto,
  SortOrder,
} from './dto/list-admin-workload-queue-query.dto';
import { AdminWorkloadActionTargetDto } from './dto/admin-workload-action-target.dto';
import { UpdateAdminWorkloadStatusDto } from './dto/update-admin-workload-status.dto';
import {
  BulkAdminWorkloadActionDto,
  BulkAdminWorkloadStatusActionDto,
} from './dto/bulk-admin-workload-action.dto';
import {
  AdminWorkloadBulkActionResultDto,
  AdminWorkloadSingleActionResultDto,
} from './dto/admin-workload-action-result.dto';

const DUE_SOON_THRESHOLD_MINUTES = 60;

@Injectable()
export class AdminWorkloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminOwnershipService: AdminOwnershipService,
  ) {}

  async getSummary(actorAdminId: string): Promise<AdminWorkloadSummaryResponseDto> {
    const rows = await this.loadRows();
    const items = rows.map((row) => this.toResponse(row));

    return {
      generatedAt: new Date(),
      totalRows: items.length,
      openRows: items.filter((item) => item.isOpen).length,
      unassignedRows: items.filter(
        (item) => item.isOpen && !item.assignedAdminId,
      ).length,
      myOpenRows: items.filter(
        (item) => item.isOpen && item.assignedAdminId === actorAdminId,
      ).length,
      overdueRows: items.filter((item) => item.isOverdue).length,
      dueSoonRows: items.filter((item) => item.isDueSoon).length,
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
    };
  }

  async listQueue(
    actorAdminId: string,
    preset: AdminWorkloadQueuePreset,
    query: ListAdminWorkloadQueueQueryDto,
  ): Promise<PaginatedListResponseDto<AdminWorkloadItemResponseDto>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const rows = await this.loadRows({
      objectType: query.objectType,
      orderBy: this.toOrderBy(query.sortBy, query.sortOrder),
    });

    let items = rows.map((row) => this.toResponse(row));

    items = this.applyPreset(items, preset, actorAdminId);

    if (query.q) {
      const q = query.q.toLowerCase();

      items = items.filter((item) => {
        const metadata = item.metadata
          ? JSON.stringify(item.metadata).toLowerCase()
          : '';

        return (
          item.objectType.toLowerCase().includes(q) ||
          item.objectId.toLowerCase().includes(q) ||
          item.operationalStatus.toLowerCase().includes(q) ||
          (item.assignedAdminId ?? '').toLowerCase().includes(q) ||
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

  async listAssignees(): Promise<AdminWorkloadAssigneeListResponseDto> {
    const rows = await this.loadRows();
    const items = rows.map((row) => this.toResponse(row));
    const byAssignee = new Map<string, AdminWorkloadAssigneeResponseDto>();

    for (const item of items) {
      const key = item.assignedAdminId ?? '__UNASSIGNED__';

      const current =
        byAssignee.get(key) ??
        ({
          assignedAdminId: item.assignedAdminId,
          totalRows: 0,
          openRows: 0,
          overdueRows: 0,
          dueSoonRows: 0,
          inReviewRows: 0,
          waitingExternalRows: 0,
        } satisfies AdminWorkloadAssigneeResponseDto);

      current.totalRows += 1;

      if (item.isOpen) {
        current.openRows += 1;
      }

      if (item.isOverdue) {
        current.overdueRows += 1;
      }

      if (item.isDueSoon) {
        current.dueSoonRows += 1;
      }

      if (item.operationalStatus === AdminOwnershipOperationalStatus.IN_REVIEW) {
        current.inReviewRows += 1;
      }

      if (
        item.operationalStatus ===
        AdminOwnershipOperationalStatus.WAITING_EXTERNAL
      ) {
        current.waitingExternalRows += 1;
      }

      byAssignee.set(key, current);
    }

    return {
      generatedAt: new Date(),
      items: Array.from(byAssignee.values()).sort((a, b) => {
        if (a.assignedAdminId === null && b.assignedAdminId !== null) return -1;
        if (a.assignedAdminId !== null && b.assignedAdminId === null) return 1;
        return b.openRows - a.openRows;
      }),
    };
  }

  async claim(
    actorAdminId: string,
    dto: AdminWorkloadActionTargetDto,
  ): Promise<AdminWorkloadItemResponseDto> {
    const item = await this.adminOwnershipService.claim(actorAdminId, {
      objectType: dto.objectType,
      objectId: dto.objectId,
      note: dto.note,
      slaDueAt: dto.slaDueAt,
    });

    return this.ownershipResponseToWorkloadItem(item);
  }

  async release(
    actorAdminId: string,
    dto: AdminWorkloadActionTargetDto,
  ): Promise<AdminWorkloadItemResponseDto> {
    const item = await this.adminOwnershipService.release(actorAdminId, {
      objectType: dto.objectType,
      objectId: dto.objectId,
      note: dto.note,
    });

    return this.ownershipResponseToWorkloadItem(item);
  }

  async updateStatus(
    actorAdminId: string,
    dto: UpdateAdminWorkloadStatusDto,
  ): Promise<AdminWorkloadItemResponseDto> {
    const item = await this.adminOwnershipService.updateStatus(actorAdminId, {
      objectType: dto.objectType,
      objectId: dto.objectId,
      operationalStatus: dto.operationalStatus,
      note: dto.note,
      slaDueAt: dto.slaDueAt,
    });

    return this.ownershipResponseToWorkloadItem(item);
  }

  async bulkClaim(
    actorAdminId: string,
    dto: BulkAdminWorkloadActionDto,
  ): Promise<AdminWorkloadBulkActionResultDto> {
    return this.runBulkAction(dto.items, async (item) => {
      await this.adminOwnershipService.claim(actorAdminId, {
        objectType: item.objectType,
        objectId: item.objectId,
        note: dto.note,
        slaDueAt: dto.slaDueAt,
      });
    });
  }

  async bulkRelease(
    actorAdminId: string,
    dto: BulkAdminWorkloadActionDto,
  ): Promise<AdminWorkloadBulkActionResultDto> {
    return this.runBulkAction(dto.items, async (item) => {
      await this.adminOwnershipService.release(actorAdminId, {
        objectType: item.objectType,
        objectId: item.objectId,
        note: dto.note,
      });
    });
  }

  async bulkUpdateStatus(
    actorAdminId: string,
    dto: BulkAdminWorkloadStatusActionDto,
  ): Promise<AdminWorkloadBulkActionResultDto> {
    return this.runBulkAction(dto.items, async (item) => {
      await this.adminOwnershipService.updateStatus(actorAdminId, {
        objectType: item.objectType,
        objectId: item.objectId,
        operationalStatus: dto.operationalStatus,
        note: dto.note,
        slaDueAt: dto.slaDueAt,
      });
    });
  }

  private async runBulkAction(
    items: Array<{ objectType: AdminOwnershipObjectType; objectId: string }>,
    handler: (item: {
      objectType: AdminOwnershipObjectType;
      objectId: string;
    }) => Promise<void>,
  ): Promise<AdminWorkloadBulkActionResultDto> {
    const results: AdminWorkloadSingleActionResultDto[] = [];

    for (const item of items) {
      try {
        await handler(item);

        results.push({
          success: true,
          objectType: item.objectType,
          objectId: item.objectId,
          error: null,
        });
      } catch (error) {
        results.push({
          success: false,
          objectType: item.objectType,
          objectId: item.objectId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((result) => result.success).length;

    return {
      requestedCount: items.length,
      successCount,
      failureCount: items.length - successCount,
      results,
    };
  }

  private async loadRows(args?: {
    objectType?: AdminOwnershipObjectType;
    orderBy?: Prisma.AdminOwnershipOrderByWithRelationInput[];
  }): Promise<AdminOwnership[]> {
    return this.prisma.adminOwnership.findMany({
      where: {
        ...(args?.objectType ? { objectType: args.objectType } : {}),
      },
      orderBy: args?.orderBy ?? [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 1000,
    });
  }

  private applyPreset(
    items: AdminWorkloadItemResponseDto[],
    preset: AdminWorkloadQueuePreset,
    actorAdminId: string,
  ): AdminWorkloadItemResponseDto[] {
    switch (preset) {
      case AdminWorkloadQueuePreset.UNASSIGNED:
        return items.filter((item) => item.isOpen && !item.assignedAdminId);

      case AdminWorkloadQueuePreset.MY_QUEUE:
        return items.filter(
          (item) => item.isOpen && item.assignedAdminId === actorAdminId,
        );

      case AdminWorkloadQueuePreset.OVERDUE:
        return items.filter((item) => item.isOverdue);

      case AdminWorkloadQueuePreset.DUE_SOON:
        return items.filter((item) => item.isDueSoon);

      case AdminWorkloadQueuePreset.CLAIMED:
        return items.filter(
          (item) =>
            item.operationalStatus === AdminOwnershipOperationalStatus.CLAIMED,
        );

      case AdminWorkloadQueuePreset.IN_REVIEW:
        return items.filter(
          (item) =>
            item.operationalStatus === AdminOwnershipOperationalStatus.IN_REVIEW,
        );

      case AdminWorkloadQueuePreset.WAITING_EXTERNAL:
        return items.filter(
          (item) =>
            item.operationalStatus ===
            AdminOwnershipOperationalStatus.WAITING_EXTERNAL,
        );

      case AdminWorkloadQueuePreset.DONE:
        return items.filter(
          (item) =>
            item.operationalStatus === AdminOwnershipOperationalStatus.DONE,
        );

      case AdminWorkloadQueuePreset.RELEASED:
        return items.filter(
          (item) =>
            item.operationalStatus === AdminOwnershipOperationalStatus.RELEASED,
        );

      case AdminWorkloadQueuePreset.ALL_OPEN:
      default:
        return items.filter((item) => item.isOpen);
    }
  }

  private toResponse(item: AdminOwnership): AdminWorkloadItemResponseDto {
    const now = new Date();
    const ageMinutes = Math.max(
      0,
      Math.floor((now.getTime() - item.createdAt.getTime()) / 60_000),
    );

    const timeToSlaMinutes = item.slaDueAt
      ? Math.ceil((item.slaDueAt.getTime() - now.getTime()) / 60_000)
      : null;

    const isOpen = !this.isTerminal(item.operationalStatus);

    const isOverdue =
      isOpen && timeToSlaMinutes !== null && timeToSlaMinutes < 0;

    const isDueSoon =
      isOpen &&
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
      isOpen,
      isOverdue,
      isDueSoon,
      timeToSlaMinutes,
    };
  }

  private ownershipResponseToWorkloadItem(item: {
    id: string;
    objectType: AdminOwnershipObjectType;
    objectId: string;
    assignedAdminId: string | null;
    claimedAt: Date | null;
    releasedAt: Date | null;
    operationalStatus: AdminOwnershipOperationalStatus;
    slaDueAt: Date | null;
    completedAt: Date | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
  }): AdminWorkloadItemResponseDto {
    const now = new Date();
    const ageMinutes = Math.max(
      0,
      Math.floor((now.getTime() - item.createdAt.getTime()) / 60_000),
    );

    const timeToSlaMinutes = item.slaDueAt
      ? Math.ceil((item.slaDueAt.getTime() - now.getTime()) / 60_000)
      : null;

    const isOpen = !this.isTerminal(item.operationalStatus);

    return {
      ...item,
      ageMinutes,
      isOpen,
      isOverdue: isOpen && timeToSlaMinutes !== null && timeToSlaMinutes < 0,
      isDueSoon:
        isOpen &&
        timeToSlaMinutes !== null &&
        timeToSlaMinutes >= 0 &&
        timeToSlaMinutes <= DUE_SOON_THRESHOLD_MINUTES,
      timeToSlaMinutes,
    };
  }

  private isTerminal(status: AdminOwnershipOperationalStatus): boolean {
    return (
      status === AdminOwnershipOperationalStatus.DONE ||
      status === AdminOwnershipOperationalStatus.RELEASED
    );
  }

  private toOrderBy(
    sortBy?: AdminWorkloadSortBy,
    sortOrder?: SortOrder,
  ): Prisma.AdminOwnershipOrderByWithRelationInput[] {
    const direction = sortOrder === SortOrder.ASC ? 'asc' : 'desc';

    switch (sortBy) {
      case AdminWorkloadSortBy.CREATED_AT:
        return [{ createdAt: direction }, { id: 'desc' }];

      case AdminWorkloadSortBy.SLA_DUE_AT:
        return [{ slaDueAt: direction }, { updatedAt: 'desc' }, { id: 'desc' }];

      case AdminWorkloadSortBy.STATUS:
        return [
          { operationalStatus: direction },
          { updatedAt: 'desc' },
          { id: 'desc' },
        ];

      case AdminWorkloadSortBy.OBJECT_TYPE:
        return [
          { objectType: direction },
          { updatedAt: 'desc' },
          { id: 'desc' },
        ];

      case AdminWorkloadSortBy.ASSIGNED_ADMIN_ID:
        return [
          { assignedAdminId: direction },
          { updatedAt: 'desc' },
          { id: 'desc' },
        ];

      case AdminWorkloadSortBy.UPDATED_AT:
      default:
        return [{ updatedAt: direction }, { id: 'desc' }];
    }
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