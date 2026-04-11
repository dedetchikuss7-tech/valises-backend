import {
  AbandonmentEventStatus,
  DisputeOpeningSource,
  DisputeReasonCode,
  DisputeStatus,
  PayoutStatus,
  RefundStatus,
  ReminderChannel,
  ReminderJobStatus,
  TransactionStatus,
} from '@prisma/client';
import { AdminDashboardSummaryService } from './admin-dashboard-summary.service';

describe('AdminDashboardSummaryService', () => {
  let service: AdminDashboardSummaryService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      dispute: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      payout: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      refund: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      abandonmentEvent: {
        count: jest.fn(),
      },
      reminderJob: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      transaction: {
        findMany: jest.fn(),
      },
    };

    service = new AdminDashboardSummaryService(prisma);
  });

  it('should return consolidated admin dashboard summary with default previewLimit', async () => {
    prisma.dispute.count.mockResolvedValue(2);
    prisma.payout.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    prisma.refund.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    prisma.abandonmentEvent.count.mockResolvedValue(5);
    prisma.reminderJob.count.mockResolvedValue(6);

    prisma.dispute.findMany
      .mockResolvedValueOnce([
        { transactionId: 'tx-1' },
        { transactionId: 'tx-2' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'dp-1',
          transactionId: 'tx-1',
          reasonCode: DisputeReasonCode.NOT_DELIVERED,
          openingSource: DisputeOpeningSource.MANUAL,
          status: DisputeStatus.OPEN,
          createdAt: new Date('2026-04-11T10:00:00.000Z'),
        },
      ]);

    prisma.payout.findMany
      .mockResolvedValueOnce([
        { transactionId: 'tx-2' },
        { transactionId: 'tx-3' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'po-1',
          transactionId: 'tx-2',
          status: PayoutStatus.REQUESTED,
          amount: 1000,
          currency: 'XAF',
          createdAt: new Date('2026-04-11T10:10:00.000Z'),
        },
      ]);

    prisma.refund.findMany
      .mockResolvedValueOnce([
        { transactionId: 'tx-1' },
        { transactionId: 'tx-4' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'rf-1',
          transactionId: 'tx-1',
          status: RefundStatus.PROCESSING,
          amount: 400,
          currency: 'XAF',
          createdAt: new Date('2026-04-11T10:15:00.000Z'),
        },
      ]);

    prisma.reminderJob.findMany.mockResolvedValue([
      {
        id: 'job-1',
        abandonmentEventId: 'event-1',
        status: ReminderJobStatus.PENDING,
        channel: ReminderChannel.EMAIL,
        scheduledFor: new Date('2026-04-11T09:00:00.000Z'),
        abandonmentEvent: {
          kind: 'KYC_PENDING',
        },
      },
    ]);

    prisma.transaction.findMany.mockResolvedValue([
      { id: 'tx-1', status: TransactionStatus.DISPUTED },
      { id: 'tx-2', status: TransactionStatus.DISPUTED },
      { id: 'tx-3', status: TransactionStatus.DELIVERED },
      { id: 'tx-4', status: TransactionStatus.CANCELLED },
    ]);

    const result = await service.getSummary({});

    expect(result.previewLimit).toBe(5);
    expect(result.counts).toEqual({
      openDisputesCount: 2,
      requestedPayoutsCount: 3,
      processingPayoutsCount: 1,
      requestedRefundsCount: 4,
      processingRefundsCount: 2,
      transactionsRequiringAttentionCount: 4,
      activeAbandonmentEventsCount: 5,
      actionableReminderJobsCount: 6,
    });

    expect(result.recentOpenDisputes).toHaveLength(1);
    expect(result.pendingPayouts).toHaveLength(1);
    expect(result.pendingRefunds).toHaveLength(1);
    expect(result.actionableReminderJobs).toEqual([
      {
        id: 'job-1',
        abandonmentEventId: 'event-1',
        status: ReminderJobStatus.PENDING,
        channel: ReminderChannel.EMAIL,
        scheduledFor: new Date('2026-04-11T09:00:00.000Z'),
        abandonmentKind: 'KYC_PENDING',
      },
    ]);
    expect(result.transactionsRequiringAttentionPreview).toEqual([
      {
        transactionId: 'tx-1',
        status: TransactionStatus.DISPUTED,
        hasOpenDispute: true,
        hasRequestedPayout: false,
        hasRequestedRefund: true,
      },
      {
        transactionId: 'tx-2',
        status: TransactionStatus.DISPUTED,
        hasOpenDispute: true,
        hasRequestedPayout: true,
        hasRequestedRefund: false,
      },
      {
        transactionId: 'tx-3',
        status: TransactionStatus.DELIVERED,
        hasOpenDispute: false,
        hasRequestedPayout: true,
        hasRequestedRefund: false,
      },
      {
        transactionId: 'tx-4',
        status: TransactionStatus.CANCELLED,
        hasOpenDispute: false,
        hasRequestedPayout: false,
        hasRequestedRefund: true,
      },
    ]);
  });

  it('should clamp previewLimit to 20', async () => {
    prisma.dispute.count.mockResolvedValue(0);
    prisma.payout.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prisma.refund.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prisma.abandonmentEvent.count.mockResolvedValue(0);
    prisma.reminderJob.count.mockResolvedValue(0);

    prisma.dispute.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.payout.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.refund.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.reminderJob.findMany.mockResolvedValue([]);
    prisma.transaction.findMany.mockResolvedValue([]);

    const result = await service.getSummary({ previewLimit: 999 });

    expect(result.previewLimit).toBe(20);
  });

  it('should avoid transaction lookup when there are no attention transactions', async () => {
    prisma.dispute.count.mockResolvedValue(0);
    prisma.payout.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prisma.refund.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prisma.abandonmentEvent.count.mockResolvedValue(0);
    prisma.reminderJob.count.mockResolvedValue(0);

    prisma.dispute.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.payout.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.refund.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.reminderJob.findMany.mockResolvedValue([]);

    const result = await service.getSummary({ previewLimit: 3 });

    expect(prisma.transaction.findMany).not.toHaveBeenCalled();
    expect(result.transactionsRequiringAttentionPreview).toEqual([]);
    expect(result.counts.transactionsRequiringAttentionCount).toBe(0);
  });
});