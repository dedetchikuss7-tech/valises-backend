import {
  AdminOwnershipObjectType,
  AdminOwnershipOperationalStatus,
} from '@prisma/client';
import { AdminWorkloadService } from './admin-workload.service';
import {
  AdminWorkloadQueuePreset,
  AdminWorkloadSortBy,
  SortOrder,
} from './dto/list-admin-workload-queue-query.dto';
import {
  AdminWorkloadRecommendedAction,
  AdminWorkloadSlaStatus,
  AdminWorkloadUrgencyLevel,
  AdminWorkloadUrgencyReason,
} from './dto/admin-workload-urgency.dto';

describe('AdminWorkloadService', () => {
  let service: AdminWorkloadService;

  const prismaMock = {
    adminOwnership: {
      findMany: jest.fn(),
    },
    adminActionAudit: {
      findMany: jest.fn(),
    },
  };

  const adminOwnershipServiceMock = {
    claim: jest.fn(),
    release: jest.fn(),
    updateStatus: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prismaMock.adminActionAudit.findMany.mockResolvedValue([]);

    service = new AdminWorkloadService(
      prismaMock as any,
      adminOwnershipServiceMock as any,
    );
  });

  const ownershipResponse = {
    id: 'own1',
    objectType: AdminOwnershipObjectType.AML,
    objectId: 'aml1',
    assignedAdminId: 'admin1',
    claimedAt: new Date(Date.now() - 10 * 60 * 1000),
    releasedAt: null,
    operationalStatus: AdminOwnershipOperationalStatus.CLAIMED,
    slaDueAt: new Date(Date.now() + 60 * 60 * 1000),
    completedAt: null,
    metadata: {},
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
    updatedAt: new Date(),
  };

  const baseRows = [
    {
      id: 'own1',
      objectType: AdminOwnershipObjectType.AML,
      objectId: 'aml1',
      assignedAdminId: null,
      claimedAt: null,
      releasedAt: null,
      operationalStatus: AdminOwnershipOperationalStatus.NEW,
      slaDueAt: new Date(Date.now() + 30 * 60 * 1000),
      completedAt: null,
      metadata: { label: 'unassigned aml' },
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
    {
      id: 'own2',
      objectType: AdminOwnershipObjectType.DISPUTE,
      objectId: 'disp1',
      assignedAdminId: 'admin1',
      claimedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      releasedAt: null,
      operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
      slaDueAt: new Date(Date.now() - 30 * 60 * 1000),
      completedAt: null,
      metadata: { label: 'overdue dispute' },
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 60 * 60 * 1000),
    },
    {
      id: 'own3',
      objectType: AdminOwnershipObjectType.PAYOUT,
      objectId: 'pay1',
      assignedAdminId: 'admin2',
      claimedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      releasedAt: null,
      operationalStatus: AdminOwnershipOperationalStatus.WAITING_EXTERNAL,
      slaDueAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      completedAt: null,
      metadata: { label: 'waiting provider' },
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 60 * 60 * 1000),
    },
    {
      id: 'own4',
      objectType: AdminOwnershipObjectType.REFUND,
      objectId: 'ref1',
      assignedAdminId: 'admin1',
      claimedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      releasedAt: null,
      operationalStatus: AdminOwnershipOperationalStatus.DONE,
      slaDueAt: new Date(Date.now() - 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 30 * 60 * 1000),
      metadata: { label: 'done refund' },
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
    {
      id: 'own5',
      objectType: AdminOwnershipObjectType.AML,
      objectId: 'aml-overdue-unassigned',
      assignedAdminId: null,
      claimedAt: null,
      releasedAt: null,
      operationalStatus: AdminOwnershipOperationalStatus.NEW,
      slaDueAt: new Date(Date.now() - 60 * 60 * 1000),
      completedAt: null,
      metadata: { label: 'critical unassigned overdue' },
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  ];

  it('returns workload summary for the current admin', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.getSummary('admin1');

    expect(result.totalRows).toBe(5);
    expect(result.openRows).toBe(4);
    expect(result.unassignedRows).toBe(2);
    expect(result.myOpenRows).toBe(1);
    expect(result.overdueRows).toBe(2);
    expect(result.dueSoonRows).toBe(1);
    expect(result.inReviewRows).toBe(1);
    expect(result.waitingExternalRows).toBe(1);
    expect(result.doneRows).toBe(1);
  });

  it('returns operational workload overview', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([
      {
        id: 'audit1',
        action: 'ADMIN_OWNERSHIP_STATUS_UPDATE',
        targetType: AdminOwnershipObjectType.DISPUTE,
        targetId: 'disp1',
        actorUserId: 'admin-recent',
        metadata: {},
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    ]);

    const result = await service.getOverview('admin1');

    expect(result.totalRows).toBe(5);
    expect(result.openRows).toBe(4);
    expect(result.terminalRows).toBe(1);
    expect(result.criticalRows).toBe(1);
    expect(result.highUrgencyRows).toBe(1);
    expect(result.overdueRows).toBe(2);
    expect(result.unassignedRows).toBe(2);
    expect(result.myOpenRows).toBe(1);
    expect(result.hasRecentAdminActionRows).toBe(1);
    expect(result.needsReviewAttentionRows).toBe(1);
    expect(result.byObjectType).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: AdminOwnershipObjectType.AML,
          count: 2,
        }),
      ]),
    );
    expect(result.byUrgencyLevel).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: AdminWorkloadUrgencyLevel.CRITICAL,
          count: 1,
        }),
      ]),
    );
    expect(result.bySlaStatus).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: AdminWorkloadSlaStatus.OVERDUE,
          count: 2,
        }),
      ]),
    );
    expect(result.byRecommendedAction).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: AdminWorkloadRecommendedAction.CLAIM_AND_REVIEW,
          count: 1,
        }),
      ]),
    );
    expect(result.topAssignees.length).toBeGreaterThan(0);
    expect(result.topAssignees[0]).toEqual(
      expect.objectContaining({
        assignedAdminId: null,
        openRows: 2,
      }),
    );
  });

  it('filters queue by operational status and assigned admin', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue([baseRows[1]]);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.ALL_OPEN,
      {
        operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
        assignedAdminId: 'admin1',
        limit: 20,
        offset: 0,
      },
    );

    expect(prismaMock.adminOwnership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
          assignedAdminId: 'admin1',
        }),
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0].objectId).toBe('disp1');
  });

  it('filters queue by urgency level', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.ALL_OPEN,
      {
        urgencyLevel: AdminWorkloadUrgencyLevel.CRITICAL,
        limit: 20,
        offset: 0,
      },
    );

    expect(result.total).toBe(1);
    expect(result.items[0].objectId).toBe('aml-overdue-unassigned');
  });

  it('filters queue by SLA status', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.ALL_OPEN,
      {
        slaStatus: AdminWorkloadSlaStatus.DUE_SOON,
        limit: 20,
        offset: 0,
      },
    );

    expect(result.total).toBe(1);
    expect(result.items[0].objectId).toBe('aml1');
  });

  it('filters queue by recommended action', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.ALL_OPEN,
      {
        recommendedAction: AdminWorkloadRecommendedAction.REVIEW_NOW,
        limit: 20,
        offset: 0,
      },
    );

    expect(result.total).toBe(1);
    expect(result.items[0].objectId).toBe('disp1');
  });

  it('sorts queue by urgency level', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.ALL_OPEN,
      {
        sortBy: AdminWorkloadSortBy.URGENCY_LEVEL,
        sortOrder: SortOrder.DESC,
        limit: 20,
        offset: 0,
      },
    );

    expect(result.items[0].urgencyLevel).toBe(AdminWorkloadUrgencyLevel.CRITICAL);
    expect(result.items[1].urgencyLevel).toBe(AdminWorkloadUrgencyLevel.HIGH);
  });

  it('sorts queue by admin action count', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([
      {
        id: 'audit1',
        action: 'ADMIN_OWNERSHIP_STATUS_UPDATE',
        targetType: AdminOwnershipObjectType.DISPUTE,
        targetId: 'disp1',
        actorUserId: 'admin1',
        metadata: {},
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      },
      {
        id: 'audit2',
        action: 'ADMIN_OWNERSHIP_CLAIM',
        targetType: AdminOwnershipObjectType.DISPUTE,
        targetId: 'disp1',
        actorUserId: 'admin1',
        metadata: {},
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
      },
    ]);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.ALL_OPEN,
      {
        sortBy: AdminWorkloadSortBy.ADMIN_ACTION_COUNT,
        sortOrder: SortOrder.DESC,
        limit: 20,
        offset: 0,
      },
    );

    expect(result.items[0].objectId).toBe('disp1');
    expect(result.items[0].adminActionCount).toBe(2);
  });

  it('sorts queue by last admin action date', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([
      {
        id: 'audit1',
        action: 'ADMIN_OWNERSHIP_STATUS_UPDATE',
        targetType: AdminOwnershipObjectType.AML,
        targetId: 'aml1',
        actorUserId: 'admin1',
        metadata: {},
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      },
      {
        id: 'audit2',
        action: 'ADMIN_OWNERSHIP_CLAIM',
        targetType: AdminOwnershipObjectType.DISPUTE,
        targetId: 'disp1',
        actorUserId: 'admin2',
        metadata: {},
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
      },
    ]);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.ALL_OPEN,
      {
        sortBy: AdminWorkloadSortBy.LAST_ADMIN_ACTION_AT,
        sortOrder: SortOrder.DESC,
        limit: 20,
        offset: 0,
      },
    );

    expect(result.items[0].objectId).toBe('aml1');
    expect(result.items[1].objectId).toBe('disp1');
  });

  it('sorts queue by needs review attention', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.ALL_OPEN,
      {
        sortBy: AdminWorkloadSortBy.NEEDS_REVIEW_ATTENTION,
        sortOrder: SortOrder.DESC,
        limit: 20,
        offset: 0,
      },
    );

    expect(result.items[0].needsReviewAttention).toBe(true);
  });

  it('lists the unassigned queue with urgency and review visibility signals', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.UNASSIGNED,
      {
        limit: 20,
        offset: 0,
      },
    );

    expect(result.total).toBe(2);
    expect(result.items[0].urgencyLevel).toBeDefined();
    expect(result.items[0].slaStatus).toBeDefined();
    expect(result.items[0].recommendedAction).toBeDefined();
    expect(result.items[0].lastAdminActionAt).toBeNull();
    expect(result.items[0].adminActionCount).toBe(0);
    expect(result.items[0].hasRecentAdminAction).toBe(false);
  });

  it('marks unassigned overdue rows as critical with claim and review recommendation', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.OVERDUE,
      {
        q: 'critical',
        limit: 20,
        offset: 0,
      },
    );

    expect(result.total).toBe(1);
    expect(result.items[0].objectId).toBe('aml-overdue-unassigned');
    expect(result.items[0].slaStatus).toBe(AdminWorkloadSlaStatus.OVERDUE);
    expect(result.items[0].urgencyLevel).toBe(
      AdminWorkloadUrgencyLevel.CRITICAL,
    );
    expect(result.items[0].urgencyReasons).toEqual(
      expect.arrayContaining([
        AdminWorkloadUrgencyReason.SLA_OVERDUE,
        AdminWorkloadUrgencyReason.UNASSIGNED_OPEN,
        AdminWorkloadUrgencyReason.UNASSIGNED_OVERDUE,
      ]),
    );
    expect(result.items[0].recommendedAction).toBe(
      AdminWorkloadRecommendedAction.CLAIM_AND_REVIEW,
    );
    expect(result.items[0].needsReviewAttention).toBe(true);
  });

  it('does not mark urgent rows as needing review attention when a recent admin action exists', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([
      {
        id: 'audit1',
        action: 'ADMIN_OWNERSHIP_STATUS_UPDATE',
        targetType: AdminOwnershipObjectType.AML,
        targetId: 'aml-overdue-unassigned',
        actorUserId: 'admin-recent',
        metadata: {},
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    ]);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.OVERDUE,
      {
        q: 'critical',
        limit: 20,
        offset: 0,
      },
    );

    expect(result.total).toBe(1);
    expect(result.items[0].hasRecentAdminAction).toBe(true);
    expect(result.items[0].needsReviewAttention).toBe(false);
    expect(result.items[0].lastAdminActionBy).toBe('admin-recent');
    expect(result.items[0].lastAdminActionType).toBe(
      'ADMIN_OWNERSHIP_STATUS_UPDATE',
    );
    expect(result.items[0].adminActionCount).toBe(1);
  });

  it('keeps urgent rows needing review attention when only old admin actions exist', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([
      {
        id: 'audit-old',
        action: 'ADMIN_OWNERSHIP_STATUS_UPDATE',
        targetType: AdminOwnershipObjectType.AML,
        targetId: 'aml-overdue-unassigned',
        actorUserId: 'admin-old',
        metadata: {},
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
    ]);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.OVERDUE,
      {
        q: 'critical',
        limit: 20,
        offset: 0,
      },
    );

    expect(result.total).toBe(1);
    expect(result.items[0].hasRecentAdminAction).toBe(false);
    expect(result.items[0].needsReviewAttention).toBe(true);
    expect(result.items[0].lastAdminActionBy).toBe('admin-old');
    expect(result.items[0].adminActionCount).toBe(1);
  });

  it('filters queue rows by review attention flag', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.ALL_OPEN,
      {
        needsReviewAttention: true,
        limit: 20,
        offset: 0,
      },
    );

    expect(result.items.every((item) => item.needsReviewAttention)).toBe(true);
    expect(result.items.map((item) => item.objectId)).toEqual(
      expect.arrayContaining(['disp1', 'aml-overdue-unassigned']),
    );
  });

  it('filters queue rows by recent admin action flag', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([
      {
        id: 'audit1',
        action: 'ADMIN_OWNERSHIP_STATUS_UPDATE',
        targetType: AdminOwnershipObjectType.DISPUTE,
        targetId: 'disp1',
        actorUserId: 'admin-recent',
        metadata: {},
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    ]);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.ALL_OPEN,
      {
        hasRecentAdminAction: true,
        limit: 20,
        offset: 0,
      },
    );

    expect(result.total).toBe(1);
    expect(result.items[0].objectId).toBe('disp1');
    expect(result.items[0].hasRecentAdminAction).toBe(true);
  });

  it('marks assigned overdue rows as high urgency', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.OVERDUE,
      {
        q: 'disp1',
        limit: 20,
        offset: 0,
      },
    );

    expect(result.total).toBe(1);
    expect(result.items[0].objectId).toBe('disp1');
    expect(result.items[0].urgencyLevel).toBe(AdminWorkloadUrgencyLevel.HIGH);
    expect(result.items[0].recommendedAction).toBe(
      AdminWorkloadRecommendedAction.REVIEW_NOW,
    );
  });

  it('marks due soon rows as medium urgency', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.DUE_SOON,
      {
        limit: 20,
        offset: 0,
      },
    );

    expect(result.total).toBe(1);
    expect(result.items[0].isDueSoon).toBe(true);
    expect(result.items[0].slaStatus).toBe(AdminWorkloadSlaStatus.DUE_SOON);
    expect(result.items[0].urgencyLevel).toBe(AdminWorkloadUrgencyLevel.MEDIUM);
  });

  it('marks waiting external rows with follow-up recommendation', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.WAITING_EXTERNAL,
      {
        limit: 20,
        offset: 0,
      },
    );

    expect(result.total).toBe(1);
    expect(result.items[0].urgencyReasons).toContain(
      AdminWorkloadUrgencyReason.WAITING_EXTERNAL,
    );
    expect(result.items[0].recommendedAction).toBe(
      AdminWorkloadRecommendedAction.FOLLOW_UP_EXTERNAL,
    );
  });

  it('marks closed done rows as low urgency', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.DONE,
      {
        limit: 20,
        offset: 0,
      },
    );

    expect(result.total).toBe(1);
    expect(result.items[0].isOpen).toBe(false);
    expect(result.items[0].slaStatus).toBe(AdminWorkloadSlaStatus.CLOSED);
    expect(result.items[0].urgencyLevel).toBe(AdminWorkloadUrgencyLevel.LOW);
    expect(result.items[0].recommendedAction).toBe(
      AdminWorkloadRecommendedAction.NONE,
    );
  });

  it('applies object type filter and q search across urgency and review fields', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([
      {
        id: 'audit1',
        action: 'ADMIN_OWNERSHIP_STATUS_UPDATE',
        targetType: AdminOwnershipObjectType.DISPUTE,
        targetId: 'disp1',
        actorUserId: 'admin-reviewer',
        metadata: {},
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    ]);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.ALL_OPEN,
      {
        objectType: AdminOwnershipObjectType.DISPUTE,
        q: 'admin-reviewer',
        sortBy: AdminWorkloadSortBy.UPDATED_AT,
        sortOrder: SortOrder.DESC,
        limit: 20,
        offset: 0,
      },
    );

    expect(prismaMock.adminOwnership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          objectType: AdminOwnershipObjectType.DISPUTE,
        }),
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0].objectId).toBe('disp1');
  });

  it('returns assignee distribution', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.listAssignees();

    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assignedAdminId: null,
          openRows: 2,
        }),
        expect.objectContaining({
          assignedAdminId: 'admin1',
          totalRows: 2,
          openRows: 1,
          overdueRows: 1,
        }),
        expect.objectContaining({
          assignedAdminId: 'admin2',
          openRows: 1,
          waitingExternalRows: 1,
        }),
      ]),
    );
  });

  it('claims one workload item through admin ownership service', async () => {
    adminOwnershipServiceMock.claim.mockResolvedValue(ownershipResponse);

    const result = await service.claim('admin1', {
      objectType: AdminOwnershipObjectType.AML,
      objectId: 'aml1',
      note: 'claim from workload',
      slaDueAt: '2099-01-01T00:00:00.000Z',
    });

    expect(adminOwnershipServiceMock.claim).toHaveBeenCalledWith('admin1', {
      objectType: AdminOwnershipObjectType.AML,
      objectId: 'aml1',
      note: 'claim from workload',
      slaDueAt: '2099-01-01T00:00:00.000Z',
    });
    expect(result.assignedAdminId).toBe('admin1');
    expect(result.isOpen).toBe(true);
    expect(result.urgencyLevel).toBeDefined();
    expect(result.hasRecentAdminAction).toBe(true);
    expect(result.lastAdminActionBy).toBe('admin1');
  });

  it('releases one workload item through admin ownership service', async () => {
    adminOwnershipServiceMock.release.mockResolvedValue({
      ...ownershipResponse,
      assignedAdminId: null,
      operationalStatus: AdminOwnershipOperationalStatus.RELEASED,
      releasedAt: new Date(),
    });

    const result = await service.release('admin1', {
      objectType: AdminOwnershipObjectType.AML,
      objectId: 'aml1',
      note: 'release from workload',
    });

    expect(adminOwnershipServiceMock.release).toHaveBeenCalledWith('admin1', {
      objectType: AdminOwnershipObjectType.AML,
      objectId: 'aml1',
      note: 'release from workload',
    });
    expect(result.assignedAdminId).toBeNull();
    expect(result.isOpen).toBe(false);
    expect(result.slaStatus).toBe(AdminWorkloadSlaStatus.CLOSED);
    expect(result.hasRecentAdminAction).toBe(true);
    expect(result.lastAdminActionType).toBe('ADMIN_OWNERSHIP_RELEASE');
  });

  it('updates one workload item status through admin ownership service', async () => {
    adminOwnershipServiceMock.updateStatus.mockResolvedValue({
      ...ownershipResponse,
      operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
    });

    const result = await service.updateStatus('admin1', {
      objectType: AdminOwnershipObjectType.AML,
      objectId: 'aml1',
      operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
      note: 'review from workload',
    });

    expect(adminOwnershipServiceMock.updateStatus).toHaveBeenCalledWith(
      'admin1',
      {
        objectType: AdminOwnershipObjectType.AML,
        objectId: 'aml1',
        operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
        note: 'review from workload',
        slaDueAt: undefined,
      },
    );
    expect(result.operationalStatus).toBe(
      AdminOwnershipOperationalStatus.IN_REVIEW,
    );
    expect(result.hasRecentAdminAction).toBe(true);
    expect(result.lastAdminActionType).toBe('ADMIN_OWNERSHIP_STATUS_UPDATE');
  });

  it('bulk claims workload items and reports partial failures', async () => {
    adminOwnershipServiceMock.claim
      .mockResolvedValueOnce(ownershipResponse)
      .mockRejectedValueOnce(new Error('already claimed'));

    const result = await service.bulkClaim('admin1', {
      items: [
        {
          objectType: AdminOwnershipObjectType.AML,
          objectId: 'aml1',
        },
        {
          objectType: AdminOwnershipObjectType.DISPUTE,
          objectId: 'disp1',
        },
      ],
      note: 'bulk claim',
    });

    expect(result.requestedCount).toBe(2);
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.results[1]).toEqual(
      expect.objectContaining({
        success: false,
        objectId: 'disp1',
        error: 'already claimed',
      }),
    );
  });

  it('bulk releases workload items', async () => {
    adminOwnershipServiceMock.release.mockResolvedValue(ownershipResponse);

    const result = await service.bulkRelease('admin1', {
      items: [
        {
          objectType: AdminOwnershipObjectType.AML,
          objectId: 'aml1',
        },
      ],
      note: 'bulk release',
    });

    expect(adminOwnershipServiceMock.release).toHaveBeenCalledWith('admin1', {
      objectType: AdminOwnershipObjectType.AML,
      objectId: 'aml1',
      note: 'bulk release',
    });
    expect(result.successCount).toBe(1);
  });

  it('bulk updates workload statuses', async () => {
    adminOwnershipServiceMock.updateStatus.mockResolvedValue(ownershipResponse);

    const result = await service.bulkUpdateStatus('admin1', {
      items: [
        {
          objectType: AdminOwnershipObjectType.AML,
          objectId: 'aml1',
        },
      ],
      operationalStatus: AdminOwnershipOperationalStatus.WAITING_EXTERNAL,
      note: 'bulk waiting external',
      slaDueAt: '2099-01-01T00:00:00.000Z',
    });

    expect(adminOwnershipServiceMock.updateStatus).toHaveBeenCalledWith(
      'admin1',
      {
        objectType: AdminOwnershipObjectType.AML,
        objectId: 'aml1',
        operationalStatus: AdminOwnershipOperationalStatus.WAITING_EXTERNAL,
        note: 'bulk waiting external',
        slaDueAt: '2099-01-01T00:00:00.000Z',
      },
    );
    expect(result.successCount).toBe(1);
  });
});