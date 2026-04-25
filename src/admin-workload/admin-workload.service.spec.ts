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

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminWorkloadService(prismaMock as any);
  });

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
});