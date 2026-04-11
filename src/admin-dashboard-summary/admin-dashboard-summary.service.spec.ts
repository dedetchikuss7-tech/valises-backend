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

    service = new AdminDashboardSummaryService(
      prisma,
      payoutService,
      refundService,
      disputeService,
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
      { id: 'tx-1', status: TransactionStatus.DISPUTED, updatedAt: new Date() },
      { id: 'tx-2', status: TransactionStatus.DISPUTED, updatedAt: new Date() },
      { id: 'tx-3', status: TransactionStatus.DELIVERED, updatedAt: new Date() },
      { id: 'tx-4', status: TransactionStatus.CANCELLED, updatedAt: new Date() },
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

  it('should return activity feed', async () => {
    prisma.adminActionAudit.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        action: 'DISPUTE_RESOLVED',
        targetType: 'DISPUTE',
        targetId: 'dp-1',
        actorUserId: 'admin-1',
        metadata: { transactionId: 'tx-1' },
        createdAt: new Date('2026-04-11T10:00:00.000Z'),
      },
    ]);

    const result = await service.getActivity({
      limit: 10,
      action: 'DISPUTE_RESOLVED',
    });

    expect(prisma.adminActionAudit.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('DISPUTE_RESOLVED');
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

    prisma.dispute.findMany.mockResolvedValue([]);
    prisma.payout.findMany.mockResolvedValue([]);
    prisma.refund.findMany.mockResolvedValue([]);
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

    prisma.dispute.findMany.mockResolvedValue([]);
    prisma.payout.findMany.mockResolvedValue([]);
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.reminderJob.findMany.mockResolvedValue([]);

    const result = await service.getSummary({ previewLimit: 3 });

    expect(prisma.transaction.findMany).not.toHaveBeenCalled();
    expect(result.transactionsRequiringAttentionPreview).toEqual([]);
    expect(result.counts.transactionsRequiringAttentionCount).toBe(0);
  });

  it('should return transactions requiring attention queue', async () => {
    prisma.dispute.findMany.mockResolvedValue([
      { transactionId: 'tx-1' },
      { transactionId: 'tx-2' },
    ]);
    prisma.payout.findMany.mockResolvedValue([
      { transactionId: 'tx-2' },
      { transactionId: 'tx-3' },
    ]);
    prisma.refund.findMany.mockResolvedValue([
      { transactionId: 'tx-1' },
      { transactionId: 'tx-4' },
    ]);
    prisma.transaction.findMany.mockResolvedValue([
      { id: 'tx-1', status: TransactionStatus.DISPUTED, updatedAt: new Date() },
      { id: 'tx-2', status: TransactionStatus.DISPUTED, updatedAt: new Date() },
      { id: 'tx-3', status: TransactionStatus.DELIVERED, updatedAt: new Date() },
      { id: 'tx-4', status: TransactionStatus.CANCELLED, updatedAt: new Date() },
    ]);

    const result = await service.getTransactionsRequiringAttentionQueue({
      limit: 50,
    });

    expect(result).toHaveLength(4);
  });

  it('should return open disputes queue', async () => {
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

    const result = await service.getOpenDisputesQueue({ limit: 10 });

    expect(result).toHaveLength(1);
  });

  it('should return pending payouts queue', async () => {
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

    const result = await service.getPendingPayoutsQueue({ limit: 10 });

    expect(result).toHaveLength(1);
  });

  it('should return pending refunds queue', async () => {
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

    const result = await service.getPendingRefundsQueue({ limit: 10 });

    expect(result).toHaveLength(1);
  });

  it('should return actionable reminder jobs queue', async () => {
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

    const result = await service.getActionableReminderJobsQueue({ limit: 10 });

    expect(result).toHaveLength(1);
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

    expect(payoutService.markPaid).toHaveBeenCalledTimes(2);
    expect(result.requestedCount).toBe(2);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
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

    expect(result.requestedCount).toBe(2);
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.results[1].error).toBe('Payout not found');
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

    expect(refundService.markRefunded).toHaveBeenCalledTimes(1);
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

    expect(refundService.markFailed).toHaveBeenCalledTimes(1);
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

    expect(disputeService.resolve).toHaveBeenCalledTimes(2);
    expect(result.requestedCount).toBe(2);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
  });
});