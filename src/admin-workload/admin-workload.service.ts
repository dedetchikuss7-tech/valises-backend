import { Injectable } from '@nestjs/common';
import {
  AdminActionAudit,
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
import {
  AdminWorkloadRecommendedAction,
  AdminWorkloadSlaStatus,
  AdminWorkloadUrgencyLevel,
  AdminWorkloadUrgencyReason,
} from './dto/admin-workload-urgency.dto';
import {
  AdminWorkloadBreakdownItemDto,
  AdminWorkloadOverviewResponseDto,
  AdminWorkloadTopAssigneeDto,
} from './dto/admin-workload-overview-response.dto';

const DUE_SOON_THRESHOLD_MINUTES = 60;
const RECENT_ADMIN_ACTION_THRESHOLD_MINUTES = 60;

type OwnershipLike = {
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
};

type WorkloadUrgencySignals = {
  slaStatus: AdminWorkloadSlaStatus;
  urgencyLevel: AdminWorkloadUrgencyLevel;
  urgencyReasons: AdminWorkloadUrgencyReason[];
  recommendedAction: AdminWorkloadRecommendedAction;
};

type WorkloadAuditSignals = {
  lastAdminActionAt: Date | null;
  lastAdminActionBy: string | null;
  lastAdminActionType: string | null;
  adminActionCount: number;
  hasRecentAdminAction: boolean;
};

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

  async getOverview(
    actorAdminId: string,
  ): Promise<AdminWorkloadOverviewResponseDto> {
    const rows = await this.loadRows();
    const auditSignalsByObject = await this.loadAuditSignals(rows);

    const items = rows.map((row) =>
      this.toResponse(row, this.getAuditSignals(row, auditSignalsByObject)),
    );

    return {
      generatedAt: new Date(),
      totalRows: items.length,
      openRows: items.filter((item) => item.isOpen).length,
      terminalRows: items.filter((item) => !item.isOpen).length,
      criticalRows: items.filter(
        (item) => item.urgencyLevel === AdminWorkloadUrgencyLevel.CRITICAL,
      ).length,
      highUrgencyRows: items.filter(
        (item) => item.urgencyLevel === AdminWorkloadUrgencyLevel.HIGH,
      ).length,
      mediumUrgencyRows: items.filter(
        (item) => item.urgencyLevel === AdminWorkloadUrgencyLevel.MEDIUM,
      ).length,
      lowUrgencyRows: items.filter(
        (item) => item.urgencyLevel === AdminWorkloadUrgencyLevel.LOW,
      ).length,
      overdueRows: items.filter((item) => item.isOverdue).length,
      dueSoonRows: items.filter((item) => item.isDueSoon).length,
      unassignedRows: items.filter(
        (item) => item.isOpen && !item.assignedAdminId,
      ).length,
      myOpenRows: items.filter(
        (item) => item.isOpen && item.assignedAdminId === actorAdminId,
      ).length,
      needsReviewAttentionRows: items.filter(
        (item) => item.needsReviewAttention,
      ).length,
      hasRecentAdminActionRows: items.filter(
        (item) => item.hasRecentAdminAction,
      ).length,
      waitingExternalRows: items.filter(
        (item) =>
          item.operationalStatus ===
          AdminOwnershipOperationalStatus.WAITING_EXTERNAL,
      ).length,
      inReviewRows: items.filter(
        (item) =>
          item.operationalStatus === AdminOwnershipOperationalStatus.IN_REVIEW,
      ).length,
      doneRows: items.filter(
        (item) => item.operationalStatus === AdminOwnershipOperationalStatus.DONE,
      ).length,
      releasedRows: items.filter(
        (item) =>
          item.operationalStatus === AdminOwnershipOperationalStatus.RELEASED,
      ).length,
      byObjectType: this.buildBreakdown(items.map((item) => item.objectType)),
      byOperationalStatus: this.buildBreakdown(
        items.map((item) => item.operationalStatus),
      ),
      byUrgencyLevel: this.buildBreakdown(
        items.map((item) => item.urgencyLevel),
      ),
      bySlaStatus: this.buildBreakdown(items.map((item) => item.slaStatus)),
      byRecommendedAction: this.buildBreakdown(
        items.map((item) => item.recommendedAction),
      ),
      topAssignees: this.buildTopAssignees(items),
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
      operationalStatus: query.operationalStatus,
      assignedAdminId: query.assignedAdminId,
      orderBy: this.toOrderBy(query.sortBy, query.sortOrder),
    });

    const auditSignalsByObject = await this.loadAuditSignals(rows);

    let items = rows.map((row) =>
      this.toResponse(row, this.getAuditSignals(row, auditSignalsByObject)),
    );

    items = this.applyPreset(items, preset, actorAdminId);
    items = this.applyAdvancedFilters(items, query);

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
          item.slaStatus.toLowerCase().includes(q) ||
          item.urgencyLevel.toLowerCase().includes(q) ||
          item.recommendedAction.toLowerCase().includes(q) ||
          item.urgencyReasons.some((reason) =>
            reason.toLowerCase().includes(q),
          ) ||
          (item.assignedAdminId ?? '').toLowerCase().includes(q) ||
          (item.lastAdminActionBy ?? '').toLowerCase().includes(q) ||
          (item.lastAdminActionType ?? '').toLowerCase().includes(q) ||
          metadata.includes(q)
        );
      });
    }

    items = this.applyComputedSort(items, query.sortBy, query.sortOrder);

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

    return this.ownershipResponseToWorkloadItem(item, {
      lastAdminActionAt: new Date(),
      lastAdminActionBy: actorAdminId,
      lastAdminActionType: 'ADMIN_OWNERSHIP_CLAIM',
      adminActionCount: 1,
      hasRecentAdminAction: true,
    });
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

    return this.ownershipResponseToWorkloadItem(item, {
      lastAdminActionAt: new Date(),
      lastAdminActionBy: actorAdminId,
      lastAdminActionType: 'ADMIN_OWNERSHIP_RELEASE',
      adminActionCount: 1,
      hasRecentAdminAction: true,
    });
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

    return this.ownershipResponseToWorkloadItem(item, {
      lastAdminActionAt: new Date(),
      lastAdminActionBy: actorAdminId,
      lastAdminActionType: 'ADMIN_OWNERSHIP_STATUS_UPDATE',
      adminActionCount: 1,
      hasRecentAdminAction: true,
    });
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
    operationalStatus?: AdminOwnershipOperationalStatus;
    assignedAdminId?: string;
    orderBy?: Prisma.AdminOwnershipOrderByWithRelationInput[];
  }): Promise<AdminOwnership[]> {
    return this.prisma.adminOwnership.findMany({
      where: {
        ...(args?.objectType ? { objectType: args.objectType } : {}),
        ...(args?.operationalStatus
          ? { operationalStatus: args.operationalStatus }
          : {}),
        ...(args?.assignedAdminId
          ? { assignedAdminId: args.assignedAdminId }
          : {}),
      },
      orderBy: args?.orderBy ?? [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 1000,
    });
  }

  private applyAdvancedFilters(
    items: AdminWorkloadItemResponseDto[],
    query: ListAdminWorkloadQueueQueryDto,
  ): AdminWorkloadItemResponseDto[] {
    return items.filter((item) => {
      if (
        query.urgencyLevel &&
        item.urgencyLevel !== query.urgencyLevel
      ) {
        return false;
      }

      if (query.slaStatus && item.slaStatus !== query.slaStatus) {
        return false;
      }

      if (
        query.recommendedAction &&
        item.recommendedAction !== query.recommendedAction
      ) {
        return false;
      }

      if (
        query.hasRecentAdminAction !== undefined &&
        item.hasRecentAdminAction !== query.hasRecentAdminAction
      ) {
        return false;
      }

      if (
        query.needsReviewAttention !== undefined &&
        item.needsReviewAttention !== query.needsReviewAttention
      ) {
        return false;
      }

      return true;
    });
  }

  private applyComputedSort(
    items: AdminWorkloadItemResponseDto[],
    sortBy?: AdminWorkloadSortBy,
    sortOrder?: SortOrder,
  ): AdminWorkloadItemResponseDto[] {
    if (!sortBy || !this.isComputedSort(sortBy)) {
      return items;
    }

    const direction = sortOrder === SortOrder.ASC ? 1 : -1;
    const rank = this.computedSortRank(sortBy);

    return [...items].sort((a, b) => {
      const compared = this.compareValues(rank(a), rank(b));
      if (compared !== 0) {
        return compared * direction;
      }

      return b.updatedAt.getTime() - a.updatedAt.getTime() || a.id.localeCompare(b.id);
    });
  }

  private isComputedSort(sortBy: AdminWorkloadSortBy): boolean {
    return [
      AdminWorkloadSortBy.URGENCY_LEVEL,
      AdminWorkloadSortBy.SLA_STATUS,
      AdminWorkloadSortBy.RECOMMENDED_ACTION,
      AdminWorkloadSortBy.LAST_ADMIN_ACTION_AT,
      AdminWorkloadSortBy.ADMIN_ACTION_COUNT,
      AdminWorkloadSortBy.NEEDS_REVIEW_ATTENTION,
    ].includes(sortBy);
  }

  private computedSortRank(
    sortBy: AdminWorkloadSortBy,
  ): (item: AdminWorkloadItemResponseDto) => string | number | boolean | null {
    switch (sortBy) {
      case AdminWorkloadSortBy.URGENCY_LEVEL:
        return (item) => this.urgencyRank(item.urgencyLevel);

      case AdminWorkloadSortBy.SLA_STATUS:
        return (item) => this.slaStatusRank(item.slaStatus);

      case AdminWorkloadSortBy.RECOMMENDED_ACTION:
        return (item) => item.recommendedAction;

      case AdminWorkloadSortBy.LAST_ADMIN_ACTION_AT:
        return (item) => item.lastAdminActionAt?.getTime() ?? null;

      case AdminWorkloadSortBy.ADMIN_ACTION_COUNT:
        return (item) => item.adminActionCount;

      case AdminWorkloadSortBy.NEEDS_REVIEW_ATTENTION:
        return (item) => item.needsReviewAttention;

      default:
        return () => null;
    }
  }

  private urgencyRank(level: AdminWorkloadUrgencyLevel): number {
    switch (level) {
      case AdminWorkloadUrgencyLevel.CRITICAL:
        return 4;
      case AdminWorkloadUrgencyLevel.HIGH:
        return 3;
      case AdminWorkloadUrgencyLevel.MEDIUM:
        return 2;
      case AdminWorkloadUrgencyLevel.LOW:
      default:
        return 1;
    }
  }

  private slaStatusRank(status: AdminWorkloadSlaStatus): number {
    switch (status) {
      case AdminWorkloadSlaStatus.OVERDUE:
        return 5;
      case AdminWorkloadSlaStatus.DUE_SOON:
        return 4;
      case AdminWorkloadSlaStatus.OK:
        return 3;
      case AdminWorkloadSlaStatus.NONE:
        return 2;
      case AdminWorkloadSlaStatus.CLOSED:
      default:
        return 1;
    }
  }

  private compareValues(
    a: string | number | boolean | null,
    b: string | number | boolean | null,
  ): number {
    if (a === b) {
      return 0;
    }

    if (a === null) {
      return -1;
    }

    if (b === null) {
      return 1;
    }

    if (typeof a === 'boolean' && typeof b === 'boolean') {
      return Number(a) - Number(b);
    }

    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }

    return String(a).localeCompare(String(b));
  }

  private async loadAuditSignals(
    rows: AdminOwnership[],
  ): Promise<Map<string, WorkloadAuditSignals>> {
    if (rows.length === 0) {
      return new Map();
    }

    const audits = await this.prisma.adminActionAudit.findMany({
      where: {
        OR: rows.map((row) => ({
          targetType: row.objectType,
          targetId: row.objectId,
        })),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 5000,
    });

    return this.buildAuditSignalMap(audits);
  }

  private buildAuditSignalMap(
    audits: AdminActionAudit[],
  ): Map<string, WorkloadAuditSignals> {
    const map = new Map<string, WorkloadAuditSignals>();

    for (const audit of audits) {
      const key = this.objectKey(audit.targetType, audit.targetId);
      const current =
        map.get(key) ??
        ({
          lastAdminActionAt: audit.createdAt,
          lastAdminActionBy: audit.actorUserId,
          lastAdminActionType: audit.action,
          adminActionCount: 0,
          hasRecentAdminAction: this.isRecentAdminAction(audit.createdAt),
        } satisfies WorkloadAuditSignals);

      current.adminActionCount += 1;

      if (audit.createdAt > (current.lastAdminActionAt ?? new Date(0))) {
        current.lastAdminActionAt = audit.createdAt;
        current.lastAdminActionBy = audit.actorUserId;
        current.lastAdminActionType = audit.action;
        current.hasRecentAdminAction = this.isRecentAdminAction(audit.createdAt);
      }

      map.set(key, current);
    }

    return map;
  }

  private getAuditSignals(
    item: AdminOwnership | OwnershipLike,
    signals: Map<string, WorkloadAuditSignals>,
  ): WorkloadAuditSignals {
    return (
      signals.get(this.objectKey(item.objectType, item.objectId)) ??
      this.emptyAuditSignals()
    );
  }

  private emptyAuditSignals(): WorkloadAuditSignals {
    return {
      lastAdminActionAt: null,
      lastAdminActionBy: null,
      lastAdminActionType: null,
      adminActionCount: 0,
      hasRecentAdminAction: false,
    };
  }

  private isRecentAdminAction(actionDate: Date): boolean {
    const ageMinutes = Math.floor(
      (Date.now() - actionDate.getTime()) / 60_000,
    );

    return ageMinutes <= RECENT_ADMIN_ACTION_THRESHOLD_MINUTES;
  }

  private objectKey(targetType: string, targetId: string): string {
    return `${targetType}:${targetId}`;
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
          (item) => item.operationalStatus === AdminOwnershipOperationalStatus.DONE,
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

  private toResponse(
    item: AdminOwnership,
    auditSignals: WorkloadAuditSignals = this.emptyAuditSignals(),
  ): AdminWorkloadItemResponseDto {
    return this.ownershipResponseToWorkloadItem(
      {
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
      },
      auditSignals,
    );
  }

  private ownershipResponseToWorkloadItem(
    item: OwnershipLike,
    auditSignals: WorkloadAuditSignals = this.emptyAuditSignals(),
  ): AdminWorkloadItemResponseDto {
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

    const urgency = this.computeUrgency({
      ...item,
      isOpen,
      isOverdue,
      isDueSoon,
      timeToSlaMinutes,
    });

    const needsReviewAttention =
      isOpen &&
      !auditSignals.hasRecentAdminAction &&
      [
        AdminWorkloadUrgencyLevel.HIGH,
        AdminWorkloadUrgencyLevel.CRITICAL,
      ].includes(urgency.urgencyLevel);

    return {
      ...item,
      ageMinutes,
      isOpen,
      isOverdue,
      isDueSoon,
      timeToSlaMinutes,
      slaStatus: urgency.slaStatus,
      urgencyLevel: urgency.urgencyLevel,
      urgencyReasons: urgency.urgencyReasons,
      recommendedAction: urgency.recommendedAction,
      lastAdminActionAt: auditSignals.lastAdminActionAt,
      lastAdminActionBy: auditSignals.lastAdminActionBy,
      lastAdminActionType: auditSignals.lastAdminActionType,
      adminActionCount: auditSignals.adminActionCount,
      hasRecentAdminAction: auditSignals.hasRecentAdminAction,
      needsReviewAttention,
    };
  }

  private computeUrgency(item: {
    assignedAdminId: string | null;
    operationalStatus: AdminOwnershipOperationalStatus;
    slaDueAt: Date | null;
    isOpen: boolean;
    isOverdue: boolean;
    isDueSoon: boolean;
    timeToSlaMinutes: number | null;
  }): WorkloadUrgencySignals {
    if (!item.isOpen) {
      if (item.operationalStatus === AdminOwnershipOperationalStatus.DONE) {
        return {
          slaStatus: AdminWorkloadSlaStatus.CLOSED,
          urgencyLevel: AdminWorkloadUrgencyLevel.LOW,
          urgencyReasons: [AdminWorkloadUrgencyReason.DONE],
          recommendedAction: AdminWorkloadRecommendedAction.NONE,
        };
      }

      return {
        slaStatus: AdminWorkloadSlaStatus.CLOSED,
        urgencyLevel: AdminWorkloadUrgencyLevel.LOW,
        urgencyReasons: [AdminWorkloadUrgencyReason.RELEASED],
        recommendedAction: AdminWorkloadRecommendedAction.NONE,
      };
    }

    const reasons: AdminWorkloadUrgencyReason[] = [];

    if (!item.slaDueAt) {
      reasons.push(AdminWorkloadUrgencyReason.NO_SLA);
    } else if (item.isOverdue) {
      reasons.push(AdminWorkloadUrgencyReason.SLA_OVERDUE);
    } else if (item.isDueSoon) {
      reasons.push(AdminWorkloadUrgencyReason.SLA_DUE_SOON);
    } else {
      reasons.push(AdminWorkloadUrgencyReason.SLA_OK);
    }

    if (!item.assignedAdminId) {
      reasons.push(AdminWorkloadUrgencyReason.UNASSIGNED_OPEN);
    }

    if (item.isOverdue && !item.assignedAdminId) {
      reasons.push(AdminWorkloadUrgencyReason.UNASSIGNED_OVERDUE);
    }

    if (item.operationalStatus === AdminOwnershipOperationalStatus.CLAIMED) {
      reasons.push(AdminWorkloadUrgencyReason.CLAIMED);
    }

    if (item.operationalStatus === AdminOwnershipOperationalStatus.IN_REVIEW) {
      reasons.push(AdminWorkloadUrgencyReason.IN_REVIEW);
    }

    if (
      item.operationalStatus ===
      AdminOwnershipOperationalStatus.WAITING_EXTERNAL
    ) {
      reasons.push(AdminWorkloadUrgencyReason.WAITING_EXTERNAL);
    }

    const slaStatus = this.computeSlaStatus(item);

    if (item.isOverdue && !item.assignedAdminId) {
      return {
        slaStatus,
        urgencyLevel: AdminWorkloadUrgencyLevel.CRITICAL,
        urgencyReasons: reasons,
        recommendedAction: AdminWorkloadRecommendedAction.CLAIM_AND_REVIEW,
      };
    }

    if (
      item.isOverdue &&
      item.operationalStatus ===
        AdminOwnershipOperationalStatus.WAITING_EXTERNAL
    ) {
      return {
        slaStatus,
        urgencyLevel: AdminWorkloadUrgencyLevel.CRITICAL,
        urgencyReasons: reasons,
        recommendedAction: AdminWorkloadRecommendedAction.FOLLOW_UP_EXTERNAL,
      };
    }

    if (item.isOverdue) {
      return {
        slaStatus,
        urgencyLevel: AdminWorkloadUrgencyLevel.HIGH,
        urgencyReasons: reasons,
        recommendedAction: AdminWorkloadRecommendedAction.REVIEW_NOW,
      };
    }

    if (
      item.operationalStatus ===
      AdminOwnershipOperationalStatus.WAITING_EXTERNAL
    ) {
      return {
        slaStatus,
        urgencyLevel: AdminWorkloadUrgencyLevel.MEDIUM,
        urgencyReasons: reasons,
        recommendedAction: AdminWorkloadRecommendedAction.FOLLOW_UP_EXTERNAL,
      };
    }

    if (item.isDueSoon) {
      return {
        slaStatus,
        urgencyLevel: AdminWorkloadUrgencyLevel.MEDIUM,
        urgencyReasons: reasons,
        recommendedAction: item.assignedAdminId
          ? AdminWorkloadRecommendedAction.REVIEW_SOON
          : AdminWorkloadRecommendedAction.CLAIM,
      };
    }

    if (!item.assignedAdminId) {
      return {
        slaStatus,
        urgencyLevel: AdminWorkloadUrgencyLevel.MEDIUM,
        urgencyReasons: reasons,
        recommendedAction: AdminWorkloadRecommendedAction.CLAIM,
      };
    }

    if (item.operationalStatus === AdminOwnershipOperationalStatus.IN_REVIEW) {
      return {
        slaStatus,
        urgencyLevel: AdminWorkloadUrgencyLevel.MEDIUM,
        urgencyReasons: reasons,
        recommendedAction: AdminWorkloadRecommendedAction.CLOSE_IF_RESOLVED,
      };
    }

    return {
      slaStatus,
      urgencyLevel: AdminWorkloadUrgencyLevel.LOW,
      urgencyReasons: reasons,
      recommendedAction: AdminWorkloadRecommendedAction.NONE,
    };
  }

  private computeSlaStatus(item: {
    isOpen: boolean;
    slaDueAt: Date | null;
    isOverdue: boolean;
    isDueSoon: boolean;
  }): AdminWorkloadSlaStatus {
    if (!item.isOpen) {
      return AdminWorkloadSlaStatus.CLOSED;
    }

    if (!item.slaDueAt) {
      return AdminWorkloadSlaStatus.NONE;
    }

    if (item.isOverdue) {
      return AdminWorkloadSlaStatus.OVERDUE;
    }

    if (item.isDueSoon) {
      return AdminWorkloadSlaStatus.DUE_SOON;
    }

    return AdminWorkloadSlaStatus.OK;
  }

  private buildBreakdown(values: string[]): AdminWorkloadBreakdownItemDto[] {
    const map = new Map<string, number>();

    for (const value of values) {
      map.set(value, (map.get(value) ?? 0) + 1);
    }

    return Array.from(map.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }

  private buildTopAssignees(
    items: AdminWorkloadItemResponseDto[],
  ): AdminWorkloadTopAssigneeDto[] {
    const map = new Map<string, AdminWorkloadTopAssigneeDto>();

    for (const item of items) {
      const key = item.assignedAdminId ?? '__UNASSIGNED__';

      const current =
        map.get(key) ??
        ({
          assignedAdminId: item.assignedAdminId,
          totalRows: 0,
          openRows: 0,
          criticalRows: 0,
          highUrgencyRows: 0,
          overdueRows: 0,
          needsReviewAttentionRows: 0,
        } satisfies AdminWorkloadTopAssigneeDto);

      current.totalRows += 1;

      if (item.isOpen) {
        current.openRows += 1;
      }

      if (item.urgencyLevel === AdminWorkloadUrgencyLevel.CRITICAL) {
        current.criticalRows += 1;
      }

      if (item.urgencyLevel === AdminWorkloadUrgencyLevel.HIGH) {
        current.highUrgencyRows += 1;
      }

      if (item.isOverdue) {
        current.overdueRows += 1;
      }

      if (item.needsReviewAttention) {
        current.needsReviewAttentionRows += 1;
      }

      map.set(key, current);
    }

    return Array.from(map.values())
      .sort((a, b) => {
        if (a.assignedAdminId === null && b.assignedAdminId !== null) return -1;
        if (a.assignedAdminId !== null && b.assignedAdminId === null) return 1;

        return (
          b.needsReviewAttentionRows - a.needsReviewAttentionRows ||
          b.criticalRows - a.criticalRows ||
          b.highUrgencyRows - a.highUrgencyRows ||
          b.openRows - a.openRows ||
          b.totalRows - a.totalRows
        );
      })
      .slice(0, 10);
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

    if (sortBy && this.isComputedSort(sortBy)) {
      return [{ updatedAt: 'desc' }, { id: 'desc' }];
    }

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