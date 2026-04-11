import { Test, TestingModule } from '@nestjs/testing';
import { AdminDashboardSummaryController } from './admin-dashboard-summary.controller';
import { AdminDashboardSummaryService } from './admin-dashboard-summary.service';

describe('AdminDashboardSummaryController', () => {
  let controller: AdminDashboardSummaryController;
  let service: jest.Mocked<AdminDashboardSummaryService>;

  beforeEach(async () => {
    const serviceMock: Partial<jest.Mocked<AdminDashboardSummaryService>> = {
      getSummary: jest.fn(),
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
});