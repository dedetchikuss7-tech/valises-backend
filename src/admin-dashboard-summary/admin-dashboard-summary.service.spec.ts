import {
  DisputeOpeningSource,
  DisputeReasonCode,
  DisputeStatus,
  PayoutStatus,
  RefundStatus,
  ReminderChannel,
  ReminderJobStatus,
  TransactionStatus,
  DisputeOutcome,
  EvidenceLevel,
} from '@prisma/client';
import { AdminDashboardSummaryService } from './admin-dashboard-summary.service';

describe('AdminDashboardSummaryService', () => {
  let service: AdminDashboardSummaryService;
  let prisma: any;
  let payoutService: any;
  let refundService: any;
  let disputeService: any;
  let adminAbandonmentService: any;

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
      adminActionAudit: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    payoutService = {
      markPaid: jest.fn(),
      markFailed: jest.fn(),
    };

    refundService = {
      markRefunded: jest.fn(),
      markFailed: jest.fn(),
    };

    disputeService = {
      resolve: jest.fn(),
    };

    adminAbandonmentService = {
      triggerReminderJob: jest.fn(),
      cancelReminderJob: jest.fn(),
      retryReminderJob: jest.fn(),
    };

    service = new AdminDashboardSummaryService(
      prisma,
      payoutService,
      refundService,
      disputeService,
      adminAbandonmentService,
    );
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

    prisma.dispute.findMany.mockImplementation(({ select, where }: any) => {
      if (
        select?.transactionId &&
        !select?.id &&
        where?.status === DisputeStatus.OPEN
      ) {
        return Promise.resolve([
          { transactionId: 'tx-1' },
          { transactionId: 'tx-2' },
        ]);
      }

      if (
        select?.id &&
        select?.reasonCode &&
        where?.status === DisputeStatus.OPEN
      ) {
        return Promise.resolve([
          {
            id: 'dp-1',
            transactionId: 'tx-1',
            reasonCode: DisputeReasonCode.NOT_DELIVERED,
            openingSource: DisputeOpeningSource.MANUAL,
            status: DisputeStatus.OPEN,
            createdAt: new Date('2026-04-11T10:00:00.000Z'),
          },
        ]);
      }

      return Promise.resolve([]);
    });

    prisma.payout.findMany.mockImplementation(({ select, where }: any) => {
      if (select?.transactionId && !select?.id && where?.status?.in) {
        return Promise.resolve([
          { transactionId: 'tx-2' },
          { transactionId: 'tx-3' },
        ]);
      }

      if (select?.id && select?.amount && where?.status?.in) {
        return Promise.resolve([
          {
            id: 'po-1',
            transactionId: 'tx-2',
            status: PayoutStatus.REQUESTED,
            amount: 1000,
            currency: 'XAF',
            createdAt: new Date('2026-04-11T10:10:00.000Z'),
          },
        ]);
      }

      return Promise.resolve([]);
    });

    prisma.refund.findMany.mockImplementation(({ select, where }: any) => {
      if (select?.transactionId && !select?.id && where?.status?.in) {
        return Promise.resolve([
          { transactionId: 'tx-1' },
          { transactionId: 'tx-4' },
        ]);
      }

      if (select?.id && select?.amount && where?.status?.in) {
        return Promise.resolve([
          {
            id: 'rf-1',
            transactionId: 'tx-1',
            status: RefundStatus.PROCESSING,
            amount: 400,
            currency: 'XAF',
            createdAt: new Date('2026-04-11T10:15:00.000Z'),
          },
        ]);
      }

      return Promise.resolve([]);
    });

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
    expect(result.counts.transactionsRequiringAttentionCount).toBe(4);
  });

  it('should return paginated activity feed', async () => {
    prisma.adminActionAudit.count.mockResolvedValue(3);
    prisma.adminActionAudit.findMany.mockResolvedValue([
      {
        id: 'audit-2',
        action: 'DISPUTE_RESOLVED',
        targetType: 'DISPUTE',
        targetId: 'dp-2',
        actorUserId: 'admin-1',
        metadata: { transactionId: 'tx-2' },
        createdAt: new Date('2026-04-11T10:00:00.000Z'),
      },
    ]);

    const result = await service.getActivity({
      limit: 1,
      offset: 1,
      action: 'DISPUTE_RESOLVED',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(prisma.adminActionAudit.count).toHaveBeenCalled();
    expect(result.total).toBe(3);
    expect(result.limit).toBe(1);
    expect(result.offset).toBe(1);
    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(1);
  });

  it('should paginate and filter transaction attention queue', async () => {
    prisma.dispute.findMany.mockResolvedValue([
      { transactionId: 'tx-1' },
      { transactionId: 'tx-2' },
    ]);
    prisma.payout.findMany.mockResolvedValue([{ transactionId: 'tx-2' }]);
    prisma.refund.findMany.mockResolvedValue([{ transactionId: 'tx-3' }]);
    prisma.transaction.findMany.mockResolvedValue([
      { id: 'tx-1', status: TransactionStatus.DISPUTED },
      { id: 'tx-2', status: TransactionStatus.DELIVERED },
      { id: 'tx-3', status: TransactionStatus.CANCELLED },
    ]);

    const result = await service.getTransactionsRequiringAttentionQueue({
      limit: 1,
      offset: 0,
      hasOpenDispute: 'true',
      sortBy: 'transactionId',
      sortOrder: 'asc',
    });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
  });

  it('should paginate and filter open disputes queue', async () => {
    prisma.dispute.count.mockResolvedValue(2);
    prisma.dispute.findMany.mockResolvedValue([
      {
        id: 'dp-1',
        transactionId: 'tx-1',
        reasonCode: DisputeReasonCode.NOT_DELIVERED,
        openingSource: DisputeOpeningSource.MANUAL,
        status: DisputeStatus.OPEN,
        createdAt: new Date('2026-04-11T10:00:00.000Z'),
      },
    ]);

    const result = await service.getOpenDisputesQueue({
      limit: 1,
      offset: 0,
      reasonCode: DisputeReasonCode.NOT_DELIVERED,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
  });

  it('should paginate pending payouts queue', async () => {
    prisma.payout.count.mockResolvedValue(2);
    prisma.payout.findMany.mockResolvedValue([
      {
        id: 'po-1',
        transactionId: 'tx-1',
        status: PayoutStatus.REQUESTED,
        amount: 1000,
        currency: 'XAF',
        createdAt: new Date('2026-04-11T10:00:00.000Z'),
      },
    ]);

    const result = await service.getPendingPayoutsQueue({
      limit: 1,
      offset: 0,
      currency: 'XAF',
      sortBy: 'amount',
      sortOrder: 'desc',
    });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
  });

  it('should paginate pending refunds queue', async () => {
    prisma.refund.count.mockResolvedValue(2);
    prisma.refund.findMany.mockResolvedValue([
      {
        id: 'rf-1',
        transactionId: 'tx-1',
        status: RefundStatus.REQUESTED,
        amount: 400,
        currency: 'XAF',
        createdAt: new Date('2026-04-11T10:00:00.000Z'),
      },
    ]);

    const result = await service.getPendingRefundsQueue({
      limit: 1,
      offset: 0,
      currency: 'XAF',
      sortBy: 'amount',
      sortOrder: 'desc',
    });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
  });

  it('should paginate and filter actionable reminder jobs queue', async () => {
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
      {
        id: 'job-2',
        abandonmentEventId: 'event-2',
        status: ReminderJobStatus.CANCELLED,
        channel: ReminderChannel.EMAIL,
        scheduledFor: new Date('2026-04-11T09:10:00.000Z'),
        abandonmentEvent: {
          kind: 'PAYMENT_PENDING',
        },
      },
    ]);

    const result = await service.getActionableReminderJobsQueue({
      limit: 1,
      offset: 0,
      channel: ReminderChannel.EMAIL,
      status: ReminderJobStatus.PENDING,
      sortBy: 'scheduledFor',
      sortOrder: 'asc',
    });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it('should bulk mark payouts as paid', async () => {
    payoutService.markPaid.mockResolvedValue({ status: PayoutStatus.PAID });

    const result = await service.bulkMarkPayoutsPaid(
      {
        ids: ['po-1', 'po-2'],
        externalReference: 'ext-123',
        note: 'done',
      },
      'admin-1',
    );

    expect(result.successCount).toBe(2);
  });

  it('should bulk mark payouts as failed with partial failure', async () => {
    payoutService.markFailed
      .mockResolvedValueOnce({ status: PayoutStatus.FAILED })
      .mockRejectedValueOnce(new Error('Payout not found'));

    const result = await service.bulkMarkPayoutsFailed(
      {
        ids: ['po-1', 'po-2'],
        reason: 'provider issue',
      },
      'admin-1',
    );

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
  });

  it('should bulk mark refunds as refunded', async () => {
    refundService.markRefunded.mockResolvedValue({
      status: RefundStatus.REFUNDED,
    });

    const result = await service.bulkMarkRefundsRefunded(
      {
        ids: ['rf-1'],
        externalReference: 'ext-rf',
        note: 'ok',
      },
      'admin-1',
    );

    expect(result.successCount).toBe(1);
  });

  it('should bulk mark refunds as failed', async () => {
    refundService.markFailed.mockResolvedValue({ status: RefundStatus.FAILED });

    const result = await service.bulkMarkRefundsFailed(
      {
        ids: ['rf-1'],
        reason: 'provider timeout',
      },
      'admin-1',
    );

    expect(result.successCount).toBe(1);
  });

  it('should bulk resolve disputes', async () => {
    disputeService.resolve.mockResolvedValue({
      payout: { id: 'po-1' },
      refund: { id: 'rf-1' },
    });

    const result = await service.bulkResolveDisputes(
      {
        ids: ['dp-1', 'dp-2'],
        outcome: DisputeOutcome.SPLIT,
        evidenceLevel: EvidenceLevel.STRONG,
        refundAmount: 400,
        releaseAmount: 600,
        notes: 'bulk resolution',
      },
      'admin-1',
    );

    expect(result.successCount).toBe(2);
  });

  it('should bulk trigger reminder jobs', async () => {
    adminAbandonmentService.triggerReminderJob.mockResolvedValue({
      action: 'TRIGGERED',
      item: { status: 'SENT' },
    });

    const result = await service.bulkTriggerReminderJobs({
      ids: ['job-1', 'job-2'],
    });

    expect(adminAbandonmentService.triggerReminderJob).toHaveBeenCalledTimes(2);
    expect(result.requestedCount).toBe(2);
    expect(result.successCount).toBe(2);
  });

  it('should bulk cancel reminder jobs', async () => {
    adminAbandonmentService.cancelReminderJob.mockResolvedValue({
      action: 'CANCELLED',
      item: { status: 'CANCELLED' },
    });

    const result = await service.bulkCancelReminderJobs({
      ids: ['job-1'],
    });

    expect(adminAbandonmentService.cancelReminderJob).toHaveBeenCalledTimes(1);
    expect(result.successCount).toBe(1);
  });

  it('should bulk retry reminder jobs with partial failure', async () => {
    adminAbandonmentService.retryReminderJob
      .mockResolvedValueOnce({
        action: 'REQUEUED',
        item: { status: 'PENDING' },
      })
      .mockRejectedValueOnce(new Error('Reminder job not found'));

    const result = await service.bulkRetryReminderJobs({
      ids: ['job-1', 'job-2'],
    });

    expect(result.requestedCount).toBe(2);
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
  });
});