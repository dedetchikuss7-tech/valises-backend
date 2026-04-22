import { Test, TestingModule } from '@nestjs/testing';
import { AdminReconciliationController } from './admin-reconciliation.controller';
import { AdminReconciliationService } from './admin-reconciliation.service';
import {
  AdminReconciliationCaseType,
  AdminReconciliationDerivedStatus,
} from './dto/list-admin-reconciliation-cases-query.dto';

describe('AdminReconciliationController', () => {
  let controller: AdminReconciliationController;

  const adminReconciliationServiceMock = {
    getSummary: jest.fn(),
    listCases: jest.fn(),
    bulkMarkReviewed: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminReconciliationController],
      providers: [
        {
          provide: AdminReconciliationService,
          useValue: adminReconciliationServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminReconciliationController>(
      AdminReconciliationController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates summary loading to the service', async () => {
    adminReconciliationServiceMock.getSummary.mockResolvedValue({
      generatedAt: new Date('2099-01-01T00:00:00.000Z'),
      totalPayoutRows: 2,
      totalRefundRows: 3,
      pendingRows: 1,
      failedRows: 1,
      mismatchRows: 2,
      requiresActionCount: 4,
    });

    const result = await controller.getSummary();

    expect(adminReconciliationServiceMock.getSummary).toHaveBeenCalled();
    expect(result.totalPayoutRows).toBe(2);
  });

  it('delegates reconciliation case listing to the service', async () => {
    adminReconciliationServiceMock.listCases.mockResolvedValue({
      items: [
        {
          caseType: AdminReconciliationCaseType.PAYOUT,
          caseId: 'pay1',
          derivedStatus: AdminReconciliationDerivedStatus.MISMATCH,
        },
      ],
      total: 1,
      limit: 10,
      offset: 0,
      hasMore: false,
    });

    const query = {
      caseType: AdminReconciliationCaseType.PAYOUT,
      status: AdminReconciliationDerivedStatus.MISMATCH,
      q: 'provider',
      requiresAction: true,
      limit: 10,
      offset: 0,
    };

    const result = await controller.listCases(query);

    expect(adminReconciliationServiceMock.listCases).toHaveBeenCalledWith(query);
    expect(result.items).toHaveLength(1);
  });

  it('delegates bulk review to the service', async () => {
    adminReconciliationServiceMock.bulkMarkReviewed.mockResolvedValue({
      requestedCount: 2,
      successCount: 2,
      failureCount: 0,
      results: [],
    });

    const dto = {
      items: [
        { caseType: AdminReconciliationCaseType.PAYOUT, caseId: 'pay1' },
        { caseType: AdminReconciliationCaseType.REFUND, caseId: 'ref1' },
      ],
      note: 'reviewed',
    };

    const result = await controller.bulkReview(
      { user: { userId: 'admin1' } },
      dto,
    );

    expect(adminReconciliationServiceMock.bulkMarkReviewed).toHaveBeenCalledWith(
      'admin1',
      dto,
    );
    expect(result.successCount).toBe(2);
  });
});