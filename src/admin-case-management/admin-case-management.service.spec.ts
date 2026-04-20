import {
  AdminActionAudit,
  AmlCaseStatus,
  DisputeStatus,
} from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { AdminCaseManagementService } from './admin-case-management.service';
import {
  AdminCaseDerivedStatus,
  AdminCaseSourceType,
} from './dto/list-admin-case-management-query.dto';

describe('AdminCaseManagementService', () => {
  let service: AdminCaseManagementService;

  const prismaMock = {
    amlCase: {
      findMany: jest.fn(),
    },
    dispute: {
      findMany: jest.fn(),
    },
    payout: {
      findMany: jest.fn(),
    },
    refund: {
      findMany: jest.fn(),
    },
    abandonmentEvent: {
      findMany: jest.fn(),
    },
    adminActionAudit: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminCaseManagementService(prismaMock as any);
  });

  it('lists transverse cases with derived statuses', async () => {
    prismaMock.amlCase.findMany.mockResolvedValue([
      {
        id: 'aml1',
        transactionId: 'tx1',
        senderId: 'sender1',
        travelerId: 'traveler1',
        currentAction: 'REQUIRE_REVIEW',
        riskLevel: 'HIGH',
        status: AmlCaseStatus.OPEN,
        reasonSummary: 'AML review required',
        signalCount: 2,
        openedAt: new Date('2099-01-05T00:00:00.000Z'),
        updatedAt: new Date('2099-01-05T01:00:00.000Z'),
      },
    ]);

    prismaMock.dispute.findMany.mockResolvedValue([]);
    prismaMock.payout.findMany.mockResolvedValue([]);
    prismaMock.refund.findMany.mockResolvedValue([]);
    prismaMock.abandonmentEvent.findMany.mockResolvedValue([]);

    prismaMock.adminActionAudit.findMany.mockResolvedValue([
      {
        id: 'audit1',
        action: 'CASE_TAKE',
        targetType: AdminCaseSourceType.AML,
        targetId: 'aml1',
        actorUserId: 'admin1',
        metadata: {},
        createdAt: new Date('2099-01-05T02:00:00.000Z'),
      } as AdminActionAudit,
      {
        id: 'audit2',
        action: 'CASE_NOTE',
        targetType: AdminCaseSourceType.AML,
        targetId: 'aml1',
        actorUserId: 'admin1',
        metadata: { note: 'Working this case' },
        createdAt: new Date('2099-01-05T03:00:00.000Z'),
      } as AdminActionAudit,
    ]);

    const result = await service.listCases({ limit: 20 });

    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe(AdminCaseSourceType.AML);
    expect(result[0].status).toBe(AdminCaseDerivedStatus.IN_PROGRESS);
    expect(result[0].assignedAdminId).toBe('admin1');
    expect(result[0].notes).toHaveLength(1);
    expect(result[0].notes[0].note).toBe('Working this case');
  });

  it('opens a transverse case from a valid source', async () => {
    prismaMock.amlCase.findMany
      .mockResolvedValueOnce([
        {
          id: 'aml1',
          transactionId: 'tx1',
          senderId: 'sender1',
          travelerId: 'traveler1',
          currentAction: 'REQUIRE_REVIEW',
          riskLevel: 'HIGH',
          status: AmlCaseStatus.OPEN,
          reasonSummary: 'AML review required',
          signalCount: 2,
          openedAt: new Date('2099-01-05T00:00:00.000Z'),
          updatedAt: new Date('2099-01-05T01:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'aml1',
          transactionId: 'tx1',
          senderId: 'sender1',
          travelerId: 'traveler1',
          currentAction: 'REQUIRE_REVIEW',
          riskLevel: 'HIGH',
          status: AmlCaseStatus.OPEN,
          reasonSummary: 'AML review required',
          signalCount: 2,
          openedAt: new Date('2099-01-05T00:00:00.000Z'),
          updatedAt: new Date('2099-01-05T01:00:00.000Z'),
        },
      ]);

    prismaMock.dispute.findMany.mockResolvedValue([]);
    prismaMock.payout.findMany.mockResolvedValue([]);
    prismaMock.refund.findMany.mockResolvedValue([]);
    prismaMock.abandonmentEvent.findMany.mockResolvedValue([]);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([]);
    prismaMock.adminActionAudit.create.mockResolvedValue({ id: 'audit1' });

    const result = await service.openFromSource(
      {
        sourceType: AdminCaseSourceType.AML,
        sourceId: 'aml1',
        note: 'Open this case',
      },
      'admin1',
    );

    expect(prismaMock.adminActionAudit.create).toHaveBeenCalledWith({
      data: {
        action: 'CASE_OPEN',
        targetType: AdminCaseSourceType.AML,
        targetId: 'aml1',
        actorUserId: 'admin1',
        metadata: {
          sourceType: AdminCaseSourceType.AML,
          sourceId: 'aml1',
          note: 'Open this case',
          transactionId: 'tx1',
          subjectUserId: 'sender1',
          secondaryUserId: 'traveler1',
          title: 'AML case REQUIRE_REVIEW',
        },
      },
    });

    expect(result.sourceType).toBe(AdminCaseSourceType.AML);
    expect(result.sourceId).toBe('aml1');
  });

  it('resolves a transverse case through audit action', async () => {
    prismaMock.amlCase.findMany.mockResolvedValue([]);
    prismaMock.dispute.findMany
      .mockResolvedValueOnce([
        {
          id: 'disp1',
          transactionId: 'tx2',
          openedById: 'sender1',
          reasonCode: 'NOT_DELIVERED',
          reason: 'Package not delivered',
          openingSource: 'MANUAL',
          evidenceStatus: 'NOT_REVIEWED',
          status: DisputeStatus.OPEN,
          createdAt: new Date('2099-01-04T00:00:00.000Z'),
          updatedAt: new Date('2099-01-04T01:00:00.000Z'),
          transaction: {
            senderId: 'sender1',
            travelerId: 'traveler2',
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'disp1',
          transactionId: 'tx2',
          openedById: 'sender1',
          reasonCode: 'NOT_DELIVERED',
          reason: 'Package not delivered',
          openingSource: 'MANUAL',
          evidenceStatus: 'NOT_REVIEWED',
          status: DisputeStatus.OPEN,
          createdAt: new Date('2099-01-04T00:00:00.000Z'),
          updatedAt: new Date('2099-01-04T01:00:00.000Z'),
          transaction: {
            senderId: 'sender1',
            travelerId: 'traveler2',
          },
        },
      ]);
    prismaMock.payout.findMany.mockResolvedValue([]);
    prismaMock.refund.findMany.mockResolvedValue([]);
    prismaMock.abandonmentEvent.findMany.mockResolvedValue([]);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([
      {
        id: 'audit1',
        action: 'CASE_RESOLVE',
        targetType: AdminCaseSourceType.DISPUTE,
        targetId: 'disp1',
        actorUserId: 'admin1',
        metadata: { note: 'Resolved' },
        createdAt: new Date('2099-01-04T02:00:00.000Z'),
      } as AdminActionAudit,
    ]);
    prismaMock.adminActionAudit.create.mockResolvedValue({ id: 'audit1' });

    const result = await service.resolveCase(
      AdminCaseSourceType.DISPUTE,
      'disp1',
      'admin1',
      { note: 'Resolved' },
    );

    expect(result.status).toBe(AdminCaseDerivedStatus.RESOLVED);
    expect(result.assignedAdminId).toBe('admin1');
  });

  it('throws when source object is missing', async () => {
    prismaMock.amlCase.findMany.mockResolvedValue([]);
    prismaMock.dispute.findMany.mockResolvedValue([]);
    prismaMock.payout.findMany.mockResolvedValue([]);
    prismaMock.refund.findMany.mockResolvedValue([]);
    prismaMock.abandonmentEvent.findMany.mockResolvedValue([]);

    await expect(
      service.openFromSource(
        {
          sourceType: AdminCaseSourceType.PAYOUT,
          sourceId: 'missing',
        },
        'admin1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filters listed cases by derived status', async () => {
    prismaMock.amlCase.findMany.mockResolvedValue([
      {
        id: 'aml1',
        transactionId: 'tx1',
        senderId: 'sender1',
        travelerId: 'traveler1',
        currentAction: 'REQUIRE_REVIEW',
        riskLevel: 'HIGH',
        status: AmlCaseStatus.OPEN,
        reasonSummary: 'AML review required',
        signalCount: 2,
        openedAt: new Date('2099-01-05T00:00:00.000Z'),
        updatedAt: new Date('2099-01-05T01:00:00.000Z'),
      },
    ]);
    prismaMock.dispute.findMany.mockResolvedValue([]);
    prismaMock.payout.findMany.mockResolvedValue([]);
    prismaMock.refund.findMany.mockResolvedValue([]);
    prismaMock.abandonmentEvent.findMany.mockResolvedValue([]);
    prismaMock.adminActionAudit.findMany.mockResolvedValue([
      {
        id: 'audit1',
        action: 'CASE_RESOLVE',
        targetType: AdminCaseSourceType.AML,
        targetId: 'aml1',
        actorUserId: 'admin1',
        metadata: {},
        createdAt: new Date('2099-01-05T02:00:00.000Z'),
      } as AdminActionAudit,
    ]);

    const result = await service.listCases({
      status: AdminCaseDerivedStatus.RESOLVED,
      limit: 20,
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe(AdminCaseDerivedStatus.RESOLVED);
  });
});