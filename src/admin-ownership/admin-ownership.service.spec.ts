import {
  AdminOwnershipObjectType,
  AdminOwnershipOperationalStatus,
} from '@prisma/client';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminOwnershipService } from './admin-ownership.service';

describe('AdminOwnershipService', () => {
  let service: AdminOwnershipService;

  const prismaMock = {
    adminOwnership: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const adminActionAuditServiceMock = {
    recordSafe: jest.fn(),
  };

  const adminTimelineServiceMock = {
    recordSafe: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new AdminOwnershipService(
      prismaMock as any,
      adminActionAuditServiceMock as any,
      adminTimelineServiceMock as any,
    );
  });

  it('claims a new admin ownership item', async () => {
    prismaMock.adminOwnership.findUnique.mockResolvedValue(null);

    prismaMock.adminOwnership.create.mockResolvedValue({
      id: 'own1',
      objectType: AdminOwnershipObjectType.AML,
      objectId: 'aml1',
      assignedAdminId: 'admin1',
      claimedAt: new Date('2099-01-01T00:00:00.000Z'),
      releasedAt: null,
      operationalStatus: AdminOwnershipOperationalStatus.CLAIMED,
      slaDueAt: new Date('2099-01-01T01:00:00.000Z'),
      completedAt: null,
      metadata: {},
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
      updatedAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    const result = await service.claim('admin1', {
      objectType: AdminOwnershipObjectType.AML,
      objectId: 'aml1',
      slaDueAt: '2099-01-01T01:00:00.000Z',
      note: 'Taking this case',
    });

    expect(prismaMock.adminOwnership.create).toHaveBeenCalled();
    expect(adminActionAuditServiceMock.recordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ADMIN_OWNERSHIP_CLAIM',
        targetType: AdminOwnershipObjectType.AML,
        targetId: 'aml1',
        actorUserId: 'admin1',
      }),
    );
    expect(adminTimelineServiceMock.recordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ADMIN_OWNERSHIP_CLAIMED',
        objectId: 'aml1',
        actorUserId: 'admin1',
      }),
    );
    expect(result.assignedAdminId).toBe('admin1');
    expect(result.operationalStatus).toBe(AdminOwnershipOperationalStatus.CLAIMED);
  });

  it('rejects claim when another admin already owns the item', async () => {
    prismaMock.adminOwnership.findUnique.mockResolvedValue({
      id: 'own1',
      objectType: AdminOwnershipObjectType.AML,
      objectId: 'aml1',
      assignedAdminId: 'admin2',
      claimedAt: new Date('2099-01-01T00:00:00.000Z'),
      releasedAt: null,
      operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
      slaDueAt: null,
      completedAt: null,
      metadata: {},
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
      updatedAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    await expect(
      service.claim('admin1', {
        objectType: AdminOwnershipObjectType.AML,
        objectId: 'aml1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('releases an existing ownership item', async () => {
    prismaMock.adminOwnership.findUnique.mockResolvedValue({
      id: 'own1',
      objectType: AdminOwnershipObjectType.PAYOUT,
      objectId: 'pay1',
      assignedAdminId: 'admin1',
      claimedAt: new Date('2099-01-01T00:00:00.000Z'),
      releasedAt: null,
      operationalStatus: AdminOwnershipOperationalStatus.CLAIMED,
      slaDueAt: null,
      completedAt: null,
      metadata: {},
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
      updatedAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    prismaMock.adminOwnership.update.mockResolvedValue({
      id: 'own1',
      objectType: AdminOwnershipObjectType.PAYOUT,
      objectId: 'pay1',
      assignedAdminId: null,
      claimedAt: new Date('2099-01-01T00:00:00.000Z'),
      releasedAt: new Date('2099-01-01T02:00:00.000Z'),
      operationalStatus: AdminOwnershipOperationalStatus.RELEASED,
      slaDueAt: null,
      completedAt: null,
      metadata: {},
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
      updatedAt: new Date('2099-01-01T02:00:00.000Z'),
    });

    const result = await service.release('admin1', {
      objectType: AdminOwnershipObjectType.PAYOUT,
      objectId: 'pay1',
      note: 'Release for reassignment',
    });

    expect(prismaMock.adminOwnership.update).toHaveBeenCalled();
    expect(adminTimelineServiceMock.recordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ADMIN_OWNERSHIP_RELEASED',
        objectId: 'pay1',
        actorUserId: 'admin1',
      }),
    );
    expect(result.assignedAdminId).toBeNull();
    expect(result.operationalStatus).toBe(AdminOwnershipOperationalStatus.RELEASED);
  });

  it('throws not found when releasing a missing item', async () => {
    prismaMock.adminOwnership.findUnique.mockResolvedValue(null);

    await expect(
      service.release('admin1', {
        objectType: AdminOwnershipObjectType.PAYOUT,
        objectId: 'missing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates status and auto-assigns active work to the acting admin when unassigned', async () => {
    prismaMock.adminOwnership.findUnique.mockResolvedValue({
      id: 'own1',
      objectType: AdminOwnershipObjectType.FINANCIAL_CONTROL,
      objectId: 'tx1',
      assignedAdminId: null,
      claimedAt: null,
      releasedAt: null,
      operationalStatus: AdminOwnershipOperationalStatus.RELEASED,
      slaDueAt: null,
      completedAt: null,
      metadata: {},
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
      updatedAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    prismaMock.adminOwnership.update.mockResolvedValue({
      id: 'own1',
      objectType: AdminOwnershipObjectType.FINANCIAL_CONTROL,
      objectId: 'tx1',
      assignedAdminId: 'admin1',
      claimedAt: new Date('2099-01-01T01:00:00.000Z'),
      releasedAt: null,
      operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
      slaDueAt: null,
      completedAt: null,
      metadata: {},
      createdAt: new Date('2099-01-01T00:00:00.000Z'),
      updatedAt: new Date('2099-01-01T01:00:00.000Z'),
    });

    const result = await service.updateStatus('admin1', {
      objectType: AdminOwnershipObjectType.FINANCIAL_CONTROL,
      objectId: 'tx1',
      operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
      note: 'Reviewing financial control',
    });

    expect(prismaMock.adminOwnership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedAdminId: 'admin1',
          operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
        }),
      }),
    );
    expect(adminTimelineServiceMock.recordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ADMIN_OWNERSHIP_STATUS_UPDATED',
        objectId: 'tx1',
        actorUserId: 'admin1',
      }),
    );
    expect(result.assignedAdminId).toBe('admin1');
  });

  it('lists ownership rows with SLA signals', async () => {
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000);

    prismaMock.adminOwnership.findMany.mockResolvedValue([
      {
        id: 'own1',
        objectType: AdminOwnershipObjectType.AML,
        objectId: 'aml1',
        assignedAdminId: 'admin1',
        claimedAt: new Date(),
        releasedAt: null,
        operationalStatus: AdminOwnershipOperationalStatus.CLAIMED,
        slaDueAt: past,
        completedAt: null,
        metadata: {},
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.list({
      onlyOverdue: true,
      limit: 20,
      offset: 0,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].isOverdue).toBe(true);
    expect(result.total).toBe(1);
  });

  it('returns ownership summary', async () => {
    prismaMock.adminOwnership.findMany.mockResolvedValue([
      {
        id: 'own1',
        objectType: AdminOwnershipObjectType.AML,
        objectId: 'aml1',
        assignedAdminId: 'admin1',
        claimedAt: new Date(),
        releasedAt: null,
        operationalStatus: AdminOwnershipOperationalStatus.CLAIMED,
        slaDueAt: null,
        completedAt: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'own2',
        objectType: AdminOwnershipObjectType.PAYOUT,
        objectId: 'pay1',
        assignedAdminId: null,
        claimedAt: null,
        releasedAt: new Date(),
        operationalStatus: AdminOwnershipOperationalStatus.RELEASED,
        slaDueAt: null,
        completedAt: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.getSummary();

    expect(result.totalRows).toBe(2);
    expect(result.claimedRows).toBe(1);
    expect(result.releasedRows).toBe(1);
    expect(result.unassignedRows).toBe(1);
  });
});