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

describe('AdminWorkloadService', () => {
  let service: AdminWorkloadService;

  const prismaMock = {
    adminOwnership: {
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
  ];

  it('returns workload summary for the current admin', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.getSummary('admin1');

    expect(result.totalRows).toBe(4);
    expect(result.openRows).toBe(3);
    expect(result.unassignedRows).toBe(1);
    expect(result.myOpenRows).toBe(1);
    expect(result.overdueRows).toBe(1);
    expect(result.dueSoonRows).toBe(1);
    expect(result.inReviewRows).toBe(1);
    expect(result.waitingExternalRows).toBe(1);
    expect(result.doneRows).toBe(1);
  });

  it('lists the unassigned queue', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.UNASSIGNED,
      {
        limit: 20,
        offset: 0,
      },
    );

    expect(result.total).toBe(1);
    expect(result.items[0].objectId).toBe('aml1');
  });

  it('lists my queue for the acting admin', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.MY_QUEUE,
      {
        limit: 20,
        offset: 0,
      },
    );

    expect(result.total).toBe(1);
    expect(result.items[0].objectId).toBe('disp1');
  });

  it('lists overdue rows', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.OVERDUE,
      {
        limit: 20,
        offset: 0,
      },
    );

    expect(result.total).toBe(1);
    expect(result.items[0].isOverdue).toBe(true);
  });

  it('lists due soon rows', async () => {
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
  });

  it('applies object type filter and q search', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue(baseRows);

    const result = await service.listQueue(
      'admin1',
      AdminWorkloadQueuePreset.ALL_OPEN,
      {
        objectType: AdminOwnershipObjectType.DISPUTE,
        q: 'overdue',
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
          openRows: 1,
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