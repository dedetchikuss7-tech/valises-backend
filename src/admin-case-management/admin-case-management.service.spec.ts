import {
  AdminActionAudit,
  AmlCaseStatus,
} from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { AdminCaseManagementService } from './admin-case-management.service';
import {
  AdminCaseDerivedStatus,
  AdminCaseSortBy,
  AdminCaseSourceType,
  SortOrder,
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

  it('lists transverse cases with audit visibility fields', async () => {
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
        actorUserId: 'admin2',
        metadata: { note: 'Working this case' },
        createdAt: new Date('2099-01-05T03:00:00.000Z'),
      } as AdminActionAudit,
    ]);

    const result = await service.listCases({ limit: 20, offset: 0 });

    expect(result.items[0].adminActionCount).toBe(2);
    expect(result.items[0].lastAdminActionBy).toBe('admin2');
    expect(result.items[0].lastAdminActionType).toBe('CASE_NOTE');
    expect(result.items[0].lastAdminActionAt?.toISOString()).toBe(
      '2099-01-05T03:00:00.000Z',
    );
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

    expect(prismaMock.adminActionAudit.create).toHaveBeenCalled();
    expect(result.sourceType).toBe(AdminCaseSourceType.AML);
  });

  it('sorts listed cases by source type ascending', async () => {
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
    prismaMock.adminActionAudit.findMany.mockResolvedValue([]);

    const result = await service.listCases({
      sortBy: AdminCaseSortBy.SOURCE_TYPE,
      sortOrder: SortOrder.ASC,
      limit: 20,
      offset: 0,
    });

    expect(result.items[0].sourceType).toBe(AdminCaseSourceType.AML);
  });

  it('bulk resolves cases with per-item results', async () => {
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
    prismaMock.adminActionAudit.findMany.mockResolvedValue([]);
    prismaMock.adminActionAudit.create.mockResolvedValue({ id: 'audit1' });

    const result = await service.bulkResolveCases('admin1', {
      items: [{ sourceType: AdminCaseSourceType.AML, sourceId: 'aml1' }],
      note: 'bulk resolve',
    });

    expect(result.successCount).toBe(1);
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
});