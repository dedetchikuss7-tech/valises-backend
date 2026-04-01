import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  DisputeOutcome,
  DisputeReasonCode,
  DisputeStatus,
  EvidenceLevel,
  PaymentStatus,
  PayoutProvider,
  RefundProvider,
  TransactionStatus,
} from '@prisma/client';
import { DisputeService } from './dispute.service';

describe('DisputeService', () => {
  let service: DisputeService;

  const prismaMock = {
    transaction: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    dispute: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    disputeResolution: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    payout: {
      findUnique: jest.fn(),
    },
    refund: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const ledgerMock = {
    getEscrowBalance: jest.fn(),
  };

  const matrixMock = {
    recommend: jest.fn(),
  };

  const payoutServiceMock = {
    requestPayoutForTransaction: jest.fn(),
  };

  const refundServiceMock = {
    requestRefundForTransaction: jest.fn(),
  };

  const adminActionAuditServiceMock = {
    recordSafe: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(async (cb: any) =>
      cb({
        disputeResolution: {
          create: prismaMock.disputeResolution.create,
        },
        dispute: {
          update: prismaMock.dispute.update,
        },
        transaction: {
          update: prismaMock.transaction.update,
        },
      }),
    );

    service = new DisputeService(
      prismaMock as any,
      ledgerMock as any,
      matrixMock as any,
      payoutServiceMock as any,
      refundServiceMock as any,
      adminActionAuditServiceMock as any,
    );
  });

  it('should create dispute and set transaction to DISPUTED', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
    });

    prismaMock.dispute.findFirst.mockResolvedValue(null);

    prismaMock.transaction.update.mockResolvedValue({
      id: 'tx1',
      status: TransactionStatus.DISPUTED,
    });

    prismaMock.dispute.create.mockResolvedValue({
      id: 'dp1',
      transactionId: 'tx1',
      openedById: 'user1',
      reason: 'Damaged',
      reasonCode: DisputeReasonCode.DAMAGED,
      status: DisputeStatus.OPEN,
    });

    const result = await service.create({
      transactionId: 'tx1',
      openedById: 'user1',
      reason: 'Damaged',
      reasonCode: DisputeReasonCode.DAMAGED,
    });

    expect(result.status).toBe(DisputeStatus.OPEN);
    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx1' },
      data: { status: TransactionStatus.DISPUTED },
    });
    expect(adminActionAuditServiceMock.recordSafe).toHaveBeenCalled();
  });

  it('should return existing open dispute instead of creating another one', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      status: TransactionStatus.DISPUTED,
      paymentStatus: PaymentStatus.SUCCESS,
    });

    prismaMock.dispute.findFirst.mockResolvedValue({
      id: 'dp-existing',
      transactionId: 'tx1',
      openedById: 'user1',
      reason: 'Damaged',
      reasonCode: DisputeReasonCode.DAMAGED,
      status: DisputeStatus.OPEN,
    });

    const result = await service.create({
      transactionId: 'tx1',
      openedById: 'user1',
      reason: 'Damaged',
      reasonCode: DisputeReasonCode.DAMAGED,
    });

    expect(result.id).toBe('dp-existing');
    expect(prismaMock.transaction.update).not.toHaveBeenCalled();
    expect(prismaMock.dispute.create).not.toHaveBeenCalled();
  });

  it('should throw if transaction not found on create', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);

    await expect(
      service.create({
        transactionId: 'missing',
        openedById: 'user1',
        reason: 'Damaged',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw if transaction is not paid on create', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      status: TransactionStatus.CREATED,
      paymentStatus: PaymentStatus.PENDING,
    });

    await expect(
      service.create({
        transactionId: 'tx1',
        openedById: 'user1',
        reason: 'Damaged',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw if transaction is cancelled on create', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      status: TransactionStatus.CANCELLED,
      paymentStatus: PaymentStatus.SUCCESS,
    });

    await expect(
      service.create({
        transactionId: 'tx1',
        openedById: 'user1',
        reason: 'Damaged',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should return recommendation', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp1',
      transactionId: 'tx1',
      reasonCode: DisputeReasonCode.DAMAGED,
      createdAt: new Date('2026-03-14T12:00:00.000Z'),
      transaction: {
        id: 'tx1',
        status: TransactionStatus.DELIVERED,
        deliveryConfirmedAt: new Date('2026-03-14T11:30:00.000Z'),
        updatedAt: new Date('2026-03-14T11:00:00.000Z'),
      },
    });

    matrixMock.recommend.mockReturnValue({
      matrixVersion: 'v1',
      recommendedOutcome: DisputeOutcome.SPLIT,
      recommendationNotes: 'Strong evidence',
    });

    const result = await service.getRecommendation('dp1', {
      evidenceLevel: EvidenceLevel.STRONG,
    });

    expect(result.recommendedOutcome).toBe(DisputeOutcome.SPLIT);
  });

  it('should resolve dispute with full refund orchestration', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp1',
      transactionId: 'tx1',
      reasonCode: DisputeReasonCode.DAMAGED,
      status: DisputeStatus.OPEN,
      createdAt: new Date('2026-03-14T12:00:00.000Z'),
      transaction: {
        id: 'tx1',
        status: TransactionStatus.DELIVERED,
        deliveryConfirmedAt: new Date('2026-03-14T11:30:00.000Z'),
        updatedAt: new Date('2026-03-14T11:00:00.000Z'),
        payout: null,
        refund: null,
      },
      resolution: null,
    });

    ledgerMock.getEscrowBalance.mockResolvedValue(1000);

    matrixMock.recommend.mockReturnValue({
      matrixVersion: 'v1',
      recommendedOutcome: DisputeOutcome.REFUND_SENDER,
      recommendationNotes: 'Refund all',
    });

    prismaMock.disputeResolution.findUnique.mockResolvedValue(null);

    prismaMock.disputeResolution.create.mockResolvedValue({
      id: 'dr1',
      disputeId: 'dp1',
      transactionId: 'tx1',
      outcome: DisputeOutcome.REFUND_SENDER,
      refundAmount: 1000,
      releaseAmount: 0,
      idempotencyKey: 'dispute_resolve:dp1',
    });

    prismaMock.dispute.update.mockResolvedValue({
      id: 'dp1',
      status: DisputeStatus.RESOLVED,
    });

    prismaMock.transaction.update.mockResolvedValue({
      id: 'tx1',
      status: TransactionStatus.DISPUTED,
    });

    refundServiceMock.requestRefundForTransaction.mockResolvedValue({
      id: 'rf1',
      transactionId: 'tx1',
      amount: 1000,
      provider: RefundProvider.MANUAL,
      status: 'REQUESTED',
    });

    const result = await service.resolve('dp1', {
      decidedById: 'admin1',
      outcome: DisputeOutcome.REFUND_SENDER,
      evidenceLevel: EvidenceLevel.STRONG,
    });

    expect(result.resolution.outcome).toBe(DisputeOutcome.REFUND_SENDER);
    expect(result.refund).not.toBeNull();
    expect(result.payout).toBeNull();
    expect(refundServiceMock.requestRefundForTransaction).toHaveBeenCalled();
    expect(adminActionAuditServiceMock.recordSafe).toHaveBeenCalled();
  });

  it('should resolve dispute with full payout orchestration', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp2',
      transactionId: 'tx2',
      reasonCode: DisputeReasonCode.NO_SHOW_SENDER,
      status: DisputeStatus.OPEN,
      createdAt: new Date('2026-03-14T12:00:00.000Z'),
      transaction: {
        id: 'tx2',
        status: TransactionStatus.DELIVERED,
        deliveryConfirmedAt: new Date('2026-03-14T11:30:00.000Z'),
        updatedAt: new Date('2026-03-14T11:00:00.000Z'),
        payout: null,
        refund: null,
      },
      resolution: null,
    });

    ledgerMock.getEscrowBalance.mockResolvedValue(900);

    matrixMock.recommend.mockReturnValue({
      matrixVersion: 'v1',
      recommendedOutcome: DisputeOutcome.RELEASE_TO_TRAVELER,
      recommendationNotes: 'Release all',
    });

    prismaMock.disputeResolution.findUnique.mockResolvedValue(null);

    prismaMock.disputeResolution.create.mockResolvedValue({
      id: 'dr2',
      disputeId: 'dp2',
      transactionId: 'tx2',
      outcome: DisputeOutcome.RELEASE_TO_TRAVELER,
      refundAmount: 0,
      releaseAmount: 900,
      idempotencyKey: 'dispute_resolve:dp2',
    });

    prismaMock.dispute.update.mockResolvedValue({
      id: 'dp2',
      status: DisputeStatus.RESOLVED,
    });

    prismaMock.transaction.update.mockResolvedValue({
      id: 'tx2',
      status: TransactionStatus.DISPUTED,
    });

    payoutServiceMock.requestPayoutForTransaction.mockResolvedValue({
      id: 'po2',
      transactionId: 'tx2',
      amount: 900,
      provider: PayoutProvider.MANUAL,
      status: 'REQUESTED',
    });

    const result = await service.resolve('dp2', {
      decidedById: 'admin1',
      outcome: DisputeOutcome.RELEASE_TO_TRAVELER,
      evidenceLevel: EvidenceLevel.STRONG,
    });

    expect(result.resolution.outcome).toBe(DisputeOutcome.RELEASE_TO_TRAVELER);
    expect(result.refund).toBeNull();
    expect(result.payout).not.toBeNull();
    expect(payoutServiceMock.requestPayoutForTransaction).toHaveBeenCalled();
  });

  it('should resolve dispute with split orchestration', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp3',
      transactionId: 'tx3',
      reasonCode: DisputeReasonCode.DAMAGED,
      status: DisputeStatus.OPEN,
      createdAt: new Date('2026-03-14T12:00:00.000Z'),
      transaction: {
        id: 'tx3',
        status: TransactionStatus.DELIVERED,
        deliveryConfirmedAt: new Date('2026-03-14T11:30:00.000Z'),
        updatedAt: new Date('2026-03-14T11:00:00.000Z'),
        payout: null,
        refund: null,
      },
      resolution: null,
    });

    ledgerMock.getEscrowBalance.mockResolvedValue(1000);

    matrixMock.recommend.mockReturnValue({
      matrixVersion: 'v1',
      recommendedOutcome: DisputeOutcome.SPLIT,
      recommendationNotes: 'Split',
    });

    prismaMock.disputeResolution.findUnique.mockResolvedValue(null);

    prismaMock.disputeResolution.create.mockResolvedValue({
      id: 'dr3',
      disputeId: 'dp3',
      transactionId: 'tx3',
      outcome: DisputeOutcome.SPLIT,
      refundAmount: 500,
      releaseAmount: 500,
      idempotencyKey: 'dispute_resolve:dp3',
    });

    prismaMock.dispute.update.mockResolvedValue({
      id: 'dp3',
      status: DisputeStatus.RESOLVED,
    });

    prismaMock.transaction.update.mockResolvedValue({
      id: 'tx3',
      status: TransactionStatus.DISPUTED,
    });

    refundServiceMock.requestRefundForTransaction.mockResolvedValue({
      id: 'rf3',
      transactionId: 'tx3',
      amount: 500,
      provider: RefundProvider.MANUAL,
      status: 'REQUESTED',
    });

    payoutServiceMock.requestPayoutForTransaction.mockResolvedValue({
      id: 'po3',
      transactionId: 'tx3',
      amount: 500,
      provider: PayoutProvider.MANUAL,
      status: 'REQUESTED',
    });

    const result = await service.resolve('dp3', {
      decidedById: 'admin1',
      outcome: DisputeOutcome.SPLIT,
      evidenceLevel: EvidenceLevel.STRONG,
    });

    expect(result.resolution.outcome).toBe(DisputeOutcome.SPLIT);
    expect(result.refund).not.toBeNull();
    expect(result.payout).not.toBeNull();
  });

  it('should reject resolve if amounts exceed escrow', async () => {
    prismaMock.dispute.findUnique.mockResolvedValue({
      id: 'dp4',
      transactionId: 'tx4',
      reasonCode: DisputeReasonCode.DAMAGED,
      status: DisputeStatus.OPEN,
      createdAt: new Date('2026-03-14T12:00:00.000Z'),
      transaction: {
        id: 'tx4',
        status: TransactionStatus.DELIVERED,
        deliveryConfirmedAt: new Date('2026-03-14T11:30:00.000Z'),
        updatedAt: new Date('2026-03-14T11:00:00.000Z'),
        payout: null,
        refund: null,
      },
      resolution: null,
    });

    ledgerMock.getEscrowBalance.mockResolvedValue(1000);

    matrixMock.recommend.mockReturnValue({
      matrixVersion: 'v1',
      recommendedOutcome: DisputeOutcome.SPLIT,
      recommendationNotes: 'Split',
    });

    prismaMock.disputeResolution.findUnique.mockResolvedValue(null);

    await expect(
      service.resolve('dp4', {
        decidedById: 'admin1',
        outcome: DisputeOutcome.SPLIT,
        evidenceLevel: EvidenceLevel.STRONG,
        refundAmount: 700,
        releaseAmount: 400,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});