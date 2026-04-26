import { AdminWorkloadDrilldownService } from './admin-workload-drilldown.service';
import {
  AdminWorkloadDrilldownPreset,
} from './dto/admin-workload-drilldown.dto';
import {
  AdminWorkloadQueuePreset,
  SortOrder,
} from './dto/list-admin-workload-queue-query.dto';
import {
  AdminWorkloadRecommendedAction,
  AdminWorkloadSlaStatus,
  AdminWorkloadUrgencyLevel,
} from './dto/admin-workload-urgency.dto';
import { AdminOwnershipOperationalStatus } from '@prisma/client';

describe('AdminWorkloadDrilldownService', () => {
  let service: AdminWorkloadDrilldownService;

  const adminWorkloadServiceMock = {
    listQueue: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminWorkloadDrilldownService(
      adminWorkloadServiceMock as any,
    );
  });

  it('lists available drilldown presets', () => {
    const result = service.listPresets();

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          preset: AdminWorkloadDrilldownPreset.CRITICAL_OPEN,
          queuePreset: AdminWorkloadQueuePreset.ALL_OPEN,
        }),
        expect.objectContaining({
          preset: AdminWorkloadDrilldownPreset.NEEDS_REVIEW_ATTENTION,
          queuePreset: AdminWorkloadQueuePreset.ALL_OPEN,
        }),
      ]),
    );
  });

  it('delegates critical open drilldown to the workload queue with critical filter', async () => {
    adminWorkloadServiceMock.listQueue.mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
      hasMore: false,
    });

    const result = await service.listDrilldown(
      'admin1',
      AdminWorkloadDrilldownPreset.CRITICAL_OPEN,
      {
        limit: 20,
        offset: 0,
      },
    );

    expect(adminWorkloadServiceMock.listQueue).toHaveBeenCalledWith(
      'admin1',
      AdminWorkloadQueuePreset.ALL_OPEN,
      expect.objectContaining({
        urgencyLevel: AdminWorkloadUrgencyLevel.CRITICAL,
        limit: 20,
        offset: 0,
      }),
    );
    expect(result.total).toBe(0);
  });

  it('delegates review attention drilldown with needsReviewAttention filter', async () => {
    adminWorkloadServiceMock.listQueue.mockResolvedValue({
      items: [],
      total: 0,
      limit: 10,
      offset: 0,
      hasMore: false,
    });

    await service.listDrilldown(
      'admin1',
      AdminWorkloadDrilldownPreset.NEEDS_REVIEW_ATTENTION,
      {
        limit: 10,
        offset: 0,
      },
    );

    expect(adminWorkloadServiceMock.listQueue).toHaveBeenCalledWith(
      'admin1',
      AdminWorkloadQueuePreset.ALL_OPEN,
      expect.objectContaining({
        needsReviewAttention: true,
        limit: 10,
        offset: 0,
      }),
    );
  });

  it('delegates unassigned overdue drilldown through unassigned queue and overdue SLA filter', async () => {
    adminWorkloadServiceMock.listQueue.mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
      hasMore: false,
    });

    await service.listDrilldown(
      'admin1',
      AdminWorkloadDrilldownPreset.UNASSIGNED_OVERDUE,
      {
        limit: 20,
        offset: 0,
      },
    );

    expect(adminWorkloadServiceMock.listQueue).toHaveBeenCalledWith(
      'admin1',
      AdminWorkloadQueuePreset.UNASSIGNED,
      expect.objectContaining({
        slaStatus: AdminWorkloadSlaStatus.OVERDUE,
      }),
    );
  });

  it('delegates waiting external drilldown with status and recommended action filters', async () => {
    adminWorkloadServiceMock.listQueue.mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
      hasMore: false,
    });

    await service.listDrilldown(
      'admin1',
      AdminWorkloadDrilldownPreset.WAITING_EXTERNAL,
      {
        limit: 20,
        offset: 0,
      },
    );

    expect(adminWorkloadServiceMock.listQueue).toHaveBeenCalledWith(
      'admin1',
      AdminWorkloadQueuePreset.WAITING_EXTERNAL,
      expect.objectContaining({
        operationalStatus: AdminOwnershipOperationalStatus.WAITING_EXTERNAL,
        recommendedAction:
          AdminWorkloadRecommendedAction.FOLLOW_UP_EXTERNAL,
      }),
    );
  });

  it('preserves frontend q and pagination while applying server-side drilldown filters', async () => {
    adminWorkloadServiceMock.listQueue.mockResolvedValue({
      items: [],
      total: 0,
      limit: 5,
      offset: 10,
      hasMore: false,
    });

    await service.listDrilldown(
      'admin1',
      AdminWorkloadDrilldownPreset.NO_RECENT_ACTION,
      {
        q: 'provider',
        limit: 5,
        offset: 10,
        sortOrder: SortOrder.ASC,
      },
    );

    expect(adminWorkloadServiceMock.listQueue).toHaveBeenCalledWith(
      'admin1',
      AdminWorkloadQueuePreset.ALL_OPEN,
      expect.objectContaining({
        q: 'provider',
        limit: 5,
        offset: 10,
        hasRecentAdminAction: false,
        sortOrder: SortOrder.ASC,
      }),
    );
  });
});