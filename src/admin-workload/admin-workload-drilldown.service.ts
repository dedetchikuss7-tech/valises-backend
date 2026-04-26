import { Injectable } from '@nestjs/common';
import { AdminOwnershipOperationalStatus } from '@prisma/client';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import { AdminWorkloadService } from './admin-workload.service';
import { AdminWorkloadItemResponseDto } from './dto/admin-workload-item-response.dto';
import {
  AdminWorkloadDrilldownPreset,
  AdminWorkloadDrilldownPresetListResponseDto,
  AdminWorkloadDrilldownPresetResponseDto,
} from './dto/admin-workload-drilldown.dto';
import { ListAdminWorkloadDrilldownQueryDto } from './dto/list-admin-workload-drilldown-query.dto';
import {
  AdminWorkloadQueuePreset,
  ListAdminWorkloadQueueQueryDto,
  SortOrder,
} from './dto/list-admin-workload-queue-query.dto';
import {
  AdminWorkloadRecommendedAction,
  AdminWorkloadSlaStatus,
  AdminWorkloadUrgencyLevel,
} from './dto/admin-workload-urgency.dto';

type DrilldownDefinition = AdminWorkloadDrilldownPresetResponseDto & {
  query: Partial<ListAdminWorkloadQueueQueryDto>;
};

@Injectable()
export class AdminWorkloadDrilldownService {
  constructor(private readonly adminWorkloadService: AdminWorkloadService) {}

  listPresets(): AdminWorkloadDrilldownPresetListResponseDto {
    return {
      generatedAt: new Date(),
      items: this.definitions().map(({ query: _query, ...definition }) => ({
        ...definition,
      })),
    };
  }

  async listDrilldown(
    actorAdminId: string,
    preset: AdminWorkloadDrilldownPreset,
    query: ListAdminWorkloadDrilldownQueryDto,
  ): Promise<PaginatedListResponseDto<AdminWorkloadItemResponseDto>> {
    const definition = this.definition(preset);

    const mergedQuery: ListAdminWorkloadQueueQueryDto = {
      ...query,
      ...definition.query,
      limit: query.limit ?? definition.query.limit ?? 20,
      offset: query.offset ?? definition.query.offset ?? 0,
      q: query.q,
      objectType: query.objectType ?? definition.query.objectType,
      sortBy: query.sortBy ?? definition.query.sortBy,
      sortOrder: query.sortOrder ?? definition.query.sortOrder,
    };

    return this.adminWorkloadService.listQueue(
      actorAdminId,
      definition.queuePreset,
      mergedQuery,
    );
  }

  private definition(preset: AdminWorkloadDrilldownPreset): DrilldownDefinition {
    const found = this.definitions().find((item) => item.preset === preset);

    if (!found) {
      return this.definitions()[0];
    }

    return found;
  }

  private definitions(): DrilldownDefinition[] {
    return [
      {
        preset: AdminWorkloadDrilldownPreset.CRITICAL_OPEN,
        title: 'Critical open workload',
        description:
          'Open workload items with critical urgency, usually requiring immediate attention.',
        queuePreset: AdminWorkloadQueuePreset.ALL_OPEN,
        appliedFilters: {
          urgencyLevel: AdminWorkloadUrgencyLevel.CRITICAL,
        },
        query: {
          urgencyLevel: AdminWorkloadUrgencyLevel.CRITICAL,
          sortOrder: SortOrder.DESC,
        },
      },
      {
        preset: AdminWorkloadDrilldownPreset.HIGH_URGENCY_OPEN,
        title: 'High urgency open workload',
        description:
          'Open workload items with high urgency, typically overdue but already assigned.',
        queuePreset: AdminWorkloadQueuePreset.ALL_OPEN,
        appliedFilters: {
          urgencyLevel: AdminWorkloadUrgencyLevel.HIGH,
        },
        query: {
          urgencyLevel: AdminWorkloadUrgencyLevel.HIGH,
          sortOrder: SortOrder.DESC,
        },
      },
      {
        preset: AdminWorkloadDrilldownPreset.NEEDS_REVIEW_ATTENTION,
        title: 'Needs review attention',
        description:
          'Open high or critical workload items without recent admin action.',
        queuePreset: AdminWorkloadQueuePreset.ALL_OPEN,
        appliedFilters: {
          needsReviewAttention: true,
        },
        query: {
          needsReviewAttention: true,
          sortOrder: SortOrder.DESC,
        },
      },
      {
        preset: AdminWorkloadDrilldownPreset.UNASSIGNED_OPEN,
        title: 'Unassigned open workload',
        description:
          'Open workload items that have not yet been assigned to an admin.',
        queuePreset: AdminWorkloadQueuePreset.UNASSIGNED,
        appliedFilters: {},
        query: {
          sortOrder: SortOrder.DESC,
        },
      },
      {
        preset: AdminWorkloadDrilldownPreset.UNASSIGNED_OVERDUE,
        title: 'Unassigned overdue workload',
        description:
          'Unassigned workload items that are already overdue and should be claimed quickly.',
        queuePreset: AdminWorkloadQueuePreset.UNASSIGNED,
        appliedFilters: {
          slaStatus: AdminWorkloadSlaStatus.OVERDUE,
        },
        query: {
          slaStatus: AdminWorkloadSlaStatus.OVERDUE,
          sortOrder: SortOrder.DESC,
        },
      },
      {
        preset: AdminWorkloadDrilldownPreset.MY_OPEN,
        title: 'My open workload',
        description:
          'Open workload items currently assigned to the authenticated admin.',
        queuePreset: AdminWorkloadQueuePreset.MY_QUEUE,
        appliedFilters: {},
        query: {
          sortOrder: SortOrder.DESC,
        },
      },
      {
        preset: AdminWorkloadDrilldownPreset.MY_OVERDUE,
        title: 'My overdue workload',
        description:
          'Overdue workload items currently assigned to the authenticated admin.',
        queuePreset: AdminWorkloadQueuePreset.OVERDUE,
        appliedFilters: {
          assignedToCurrentAdmin: true,
          slaStatus: AdminWorkloadSlaStatus.OVERDUE,
        },
        query: {
          slaStatus: AdminWorkloadSlaStatus.OVERDUE,
          sortOrder: SortOrder.DESC,
        },
      },
      {
        preset: AdminWorkloadDrilldownPreset.WAITING_EXTERNAL,
        title: 'Waiting external follow-up',
        description:
          'Workload items waiting for an external party or provider follow-up.',
        queuePreset: AdminWorkloadQueuePreset.WAITING_EXTERNAL,
        appliedFilters: {
          operationalStatus: AdminOwnershipOperationalStatus.WAITING_EXTERNAL,
          recommendedAction: AdminWorkloadRecommendedAction.FOLLOW_UP_EXTERNAL,
        },
        query: {
          operationalStatus: AdminOwnershipOperationalStatus.WAITING_EXTERNAL,
          recommendedAction: AdminWorkloadRecommendedAction.FOLLOW_UP_EXTERNAL,
          sortOrder: SortOrder.DESC,
        },
      },
      {
        preset: AdminWorkloadDrilldownPreset.DUE_SOON,
        title: 'Due soon workload',
        description:
          'Open workload items approaching their SLA deadline.',
        queuePreset: AdminWorkloadQueuePreset.DUE_SOON,
        appliedFilters: {
          slaStatus: AdminWorkloadSlaStatus.DUE_SOON,
        },
        query: {
          slaStatus: AdminWorkloadSlaStatus.DUE_SOON,
          sortOrder: SortOrder.DESC,
        },
      },
      {
        preset: AdminWorkloadDrilldownPreset.RECENTLY_TOUCHED,
        title: 'Recently touched workload',
        description:
          'Open workload items that had a recent admin action.',
        queuePreset: AdminWorkloadQueuePreset.ALL_OPEN,
        appliedFilters: {
          hasRecentAdminAction: true,
        },
        query: {
          hasRecentAdminAction: true,
          sortOrder: SortOrder.DESC,
        },
      },
      {
        preset: AdminWorkloadDrilldownPreset.NO_RECENT_ACTION,
        title: 'No recent admin action',
        description:
          'Open workload items without recent admin action.',
        queuePreset: AdminWorkloadQueuePreset.ALL_OPEN,
        appliedFilters: {
          hasRecentAdminAction: false,
        },
        query: {
          hasRecentAdminAction: false,
          sortOrder: SortOrder.DESC,
        },
      },
    ];
  }
}