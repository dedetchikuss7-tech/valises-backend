import { Test, TestingModule } from '@nestjs/testing';
import { AdminDashboardSummaryController } from './admin-dashboard-summary.controller';
import { AdminDashboardSummaryService } from './admin-dashboard-summary.service';

describe('AdminDashboardSummaryController', () => {
  let controller: AdminDashboardSummaryController;
  let service: jest.Mocked<AdminDashboardSummaryService>;

  beforeEach(async () => {
    const serviceMock: Partial<jest.Mocked<AdminDashboardSummaryService>> = {
      getSummary: jest.fn(),
      getActivity: jest.fn(),
      getTransactionsRequiringAttentionQueue: jest.fn(),
      getOpenDisputesQueue: jest.fn(),
      getPendingPayoutsQueue: jest.fn(),
      getPendingRefundsQueue: jest.fn(),
      getActionableReminderJobsQueue: jest.fn(),
      bulkMarkPayoutsPaid: jest.fn(),
      bulkMarkPayoutsFailed: jest.fn(),
      bulkMarkRefundsRefunded: jest.fn(),
      bulkMarkRefundsFailed: jest.fn(),
      bulkResolveDisputes: jest.fn(),
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
    const expected = { counts: {} } as any;

    service.getSummary.mockResolvedValue(expected);

    const result = await controller.getSummary(query);

    expect(service.getSummary).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate getActivity to service', async () => {
    const query = { limit: 10, action: 'DISPUTE_RESOLVED' };
    const expected = [{ id: 'audit-1' }] as any;

    service.getActivity.mockResolvedValue(expected);

    const result = await controller.getActivity(query);

    expect(service.getActivity).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate transactions requiring attention queue to service', async () => {
    const query = { limit: 30 };
    const expected = [{ transactionId: 'tx-1' }] as any;

    service.getTransactionsRequiringAttentionQueue.mockResolvedValue(expected);

    const result =
      await controller.getTransactionsRequiringAttentionQueue(query);

    expect(service.getTransactionsRequiringAttentionQueue).toHaveBeenCalledWith(
      query,
    );
    expect(result).toEqual(expected);
  });

  it('should delegate open disputes queue to service', async () => {
    const query = { limit: 15 };
    const expected = [{ id: 'dp-1' }] as any;

    service.getOpenDisputesQueue.mockResolvedValue(expected);

    const result = await controller.getOpenDisputesQueue(query);

    expect(service.getOpenDisputesQueue).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate pending payouts queue to service', async () => {
    const query = { limit: 10 };
    const expected = [{ id: 'po-1' }] as any;

    service.getPendingPayoutsQueue.mockResolvedValue(expected);

    const result = await controller.getPendingPayoutsQueue(query);

    expect(service.getPendingPayoutsQueue).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate pending refunds queue to service', async () => {
    const query = { limit: 10 };
    const expected = [{ id: 'rf-1' }] as any;

    service.getPendingRefundsQueue.mockResolvedValue(expected);

    const result = await controller.getPendingRefundsQueue(query);

    expect(service.getPendingRefundsQueue).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate actionable reminder jobs queue to service', async () => {
    const query = { limit: 25 };
    const expected = [{ id: 'job-1' }] as any;

    service.getActionableReminderJobsQueue.mockResolvedValue(expected);

    const result = await controller.getActionableReminderJobsQueue(query);

    expect(service.getActionableReminderJobsQueue).toHaveBeenCalledWith(query);
    expect(result).toEqual(expected);
  });

  it('should delegate bulk payouts paid action', async () => {
    service.bulkMarkPayoutsPaid.mockResolvedValue({
      requestedCount: 1,
      successCount: 1,
      failureCount: 0,
      results: [],
    });

    const result = await controller.bulkMarkPayoutsPaid(
      { ids: ['po-1'] },
      { user: { userId: 'admin-1' } } as any,
    );

    expect(service.bulkMarkPayoutsPaid).toHaveBeenCalledWith(
      { ids: ['po-1'] },
      'admin-1',
    );
    expect(result.successCount).toBe(1);
  });

  it('should delegate bulk payouts failed action', async () => {
    service.bulkMarkPayoutsFailed.mockResolvedValue({
      requestedCount: 1,
      successCount: 1,
      failureCount: 0,
      results: [],
    });

    const result = await controller.bulkMarkPayoutsFailed(
      { ids: ['po-1'], reason: 'x' },
      { user: { userId: 'admin-1' } } as any,
    );

    expect(service.bulkMarkPayoutsFailed).toHaveBeenCalledWith(
      { ids: ['po-1'], reason: 'x' },
      'admin-1',
    );
    expect(result.successCount).toBe(1);
  });

  it('should delegate bulk refunds refunded action', async () => {
    service.bulkMarkRefundsRefunded.mockResolvedValue({
      requestedCount: 1,
      successCount: 1,
      failureCount: 0,
      results: [],
    });

    const result = await controller.bulkMarkRefundsRefunded(
      { ids: ['rf-1'] },
      { user: { userId: 'admin-1' } } as any,
    );

    expect(service.bulkMarkRefundsRefunded).toHaveBeenCalledWith(
      { ids: ['rf-1'] },
      'admin-1',
    );
    expect(result.successCount).toBe(1);
  });

  it('should delegate bulk refunds failed action', async () => {
    service.bulkMarkRefundsFailed.mockResolvedValue({
      requestedCount: 1,
      successCount: 1,
      failureCount: 0,
      results: [],
    });

    const result = await controller.bulkMarkRefundsFailed(
      { ids: ['rf-1'], reason: 'x' },
      { user: { userId: 'admin-1' } } as any,
    );

    expect(service.bulkMarkRefundsFailed).toHaveBeenCalledWith(
      { ids: ['rf-1'], reason: 'x' },
      'admin-1',
    );
    expect(result.successCount).toBe(1);
  });

  it('should delegate bulk disputes resolve action', async () => {
    service.bulkResolveDisputes.mockResolvedValue({
      requestedCount: 1,
      successCount: 1,
      failureCount: 0,
      results: [],
    });

    const result = await controller.bulkResolveDisputes(
      {
        ids: ['dp-1'],
        outcome: 'SPLIT' as any,
        evidenceLevel: 'STRONG' as any,
      },
      { user: { userId: 'admin-1' } } as any,
    );

    expect(service.bulkResolveDisputes).toHaveBeenCalledWith(
      {
        ids: ['dp-1'],
        outcome: 'SPLIT',
        evidenceLevel: 'STRONG',
      },
      'admin-1',
    );
    expect(result.successCount).toBe(1);
  });
});