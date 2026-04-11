import { Test, TestingModule } from '@nestjs/testing';
import { AdminDashboardSummaryController } from './admin-dashboard-summary.controller';
import { AdminDashboardSummaryService } from './admin-dashboard-summary.service';

describe('AdminDashboardSummaryController', () => {
  let controller: AdminDashboardSummaryController;
  let service: jest.Mocked<AdminDashboardSummaryService>;

  beforeEach(async () => {
    const serviceMock: Partial<jest.Mocked<AdminDashboardSummaryService>> = {
      getSummary: jest.fn(),
      getTransactionsRequiringAttentionQueue: jest.fn(),
      getOpenDisputesQueue: jest.fn(),
      getPendingPayoutsQueue: jest.fn(),
      getPendingRefundsQueue: jest.fn(),
      getActionableReminderJobsQueue: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDashboardSummaryController],
      providers: [
        {
          provide: AdminDashboardSummaryService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get(AdminDashboardSummaryController);
    service = module.get(AdminDashboardSummaryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate getSummary to service', async () => {
    const query = { previewLimit: 7 };

    const expected = {
      serverTime: new Date().toISOString(),
      previewLimit: 7,
      counts: {
        openDisputesCount: 1,
        requestedPayoutsCount: 2,
        processingPayoutsCount: 0,
        requestedRefundsCount: 1,
        processingRefundsCount: 0,
        transactionsRequiringAttentionCount: 3,
        activeAbandonmentEventsCount: 2,
        actionableReminderJobsCount: 4,
      },
      recentOpenDisputes: [],
      pendingPayouts: [],
      pendingRefunds: [],
      actionableReminderJobs: [],
      transactionsRequiringAttentionPreview: [],
    };

    service.getSummary.mockResolvedValue(expected as any);

    const result = await controller.getSummary(query);

    expect(service.getSummary).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate transactions requiring attention queue to service', async () => {
    const query = { limit: 30 };
    const expected = [{ transactionId: 'tx-1' }];

    service.getTransactionsRequiringAttentionQueue.mockResolvedValue(
      expected as any,
    );

    const result =
      await controller.getTransactionsRequiringAttentionQueue(query);

    expect(service.getTransactionsRequiringAttentionQueue).toHaveBeenCalledWith(
      query,
    );
    expect(result).toEqual(expected);
  });

  it('should delegate open disputes queue to service', async () => {
    const query = { limit: 15 };
    const expected = [{ id: 'dp-1' }];

    service.getOpenDisputesQueue.mockResolvedValue(expected as any);

    const result = await controller.getOpenDisputesQueue(query);

    expect(service.getOpenDisputesQueue).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate pending payouts queue to service', async () => {
    const query = { limit: 10 };
    const expected = [{ id: 'po-1' }];

    service.getPendingPayoutsQueue.mockResolvedValue(expected as any);

    const result = await controller.getPendingPayoutsQueue(query);

    expect(service.getPendingPayoutsQueue).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate pending refunds queue to service', async () => {
    const query = { limit: 10 };
    const expected = [{ id: 'rf-1' }];

    service.getPendingRefundsQueue.mockResolvedValue(expected as any);

    const result = await controller.getPendingRefundsQueue(query);

    expect(service.getPendingRefundsQueue).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate actionable reminder jobs queue to service', async () => {
    const query = { limit: 25 };
    const expected = [{ id: 'job-1' }];

    service.getActionableReminderJobsQueue.mockResolvedValue(expected as any);

    const result = await controller.getActionableReminderJobsQueue(query);

    expect(service.getActionableReminderJobsQueue).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });
});