import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PaymentStatus,
  RefundProvider,
  RefundStatus,
  TransactionStatus,
} from '@prisma/client';
import { RefundService } from './refund.service';

describe('RefundService', () => {
  let service: RefundService;

  const prismaMock = {
    transaction: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    refund: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const ledgerMock = {
    getEscrowBalance: jest.fn(),
    addEntryIdempotent: jest.fn(),
  };

  const manualProviderMock = {
    provider: RefundProvider.MANUAL,
    requestRefund: jest.fn(),
  };

  const mockStripeProviderMock = {
    provider: RefundProvider.MOCK_STRIPE,
    requestRefund: jest.fn(),
  };

  const adminActionAuditMock = {
    recordSafe: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(async (cb: any) =>
      cb({
        refund: {
          update: prismaMock.refund.update,
        },
        transaction: {
          update: prismaMock.transaction.update,
        },
      }),
    );

    service = new RefundService(
      prismaMock as any,
      ledgerMock as any,
      manualProviderMock as any,
      mockStripeProviderMock as any,
      adminActionAuditMock as any,
    );
  });

  it('should request refund and dispatch to provider', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      status: TransactionStatus.DISPUTED,
      paymentStatus: PaymentStatus.SUCCESS,
      currency: 'XAF',
    });

    ledgerMock.getEscrowBalance.mockResolvedValue(1000);

    prismaMock.refund.findUnique.mockResolvedValue(null);

    prismaMock.refund.create.mockResolvedValue({
      id: 'rf1',
      transactionId: 'tx1',
      provider: RefundProvider.MANUAL,
      status: RefundStatus.READY,
      amount: 400,
      currency: 'XAF',
    });

    manualProviderMock.requestRefund.mockResolvedValue({
      status: 'REQUESTED',
      externalReference: 'manual_refund:rf1',
      metadata: { mode: 'manual' },
    });

    prismaMock.refund.update.mockResolvedValue({
      id: 'rf1',
      transactionId: 'tx1',
      provider: RefundProvider.MANUAL,
      status: RefundStatus.REQUESTED,
      amount: 400,
      currency: 'XAF',
      externalReference: 'manual_refund:rf1',
    });

    const result = await service.requestRefundForTransaction('tx1', 400);

    expect(result.status).toBe(RefundStatus.REQUESTED);
    expect(prismaMock.refund.create).toHaveBeenCalled();
    expect(manualProviderMock.requestRefund).toHaveBeenCalled();
    expect(adminActionAuditMock.recordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REFUND_REQUESTED',
        targetType: 'REFUND',
        targetId: 'rf1',
      }),
    );
  });

  it('should reject refund request if transaction not found', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);

    await expect(
      service.requestRefundForTransaction('missing', 400),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject refund request if transaction status is not DISPUTED or CANCELLED', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      status: TransactionStatus.DELIVERED,
      paymentStatus: PaymentStatus.SUCCESS,
      currency: 'XAF',
    });

    await expect(
      service.requestRefundForTransaction('tx1', 400),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject refund request if amount exceeds escrow', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      status: TransactionStatus.DISPUTED,
      paymentStatus: PaymentStatus.SUCCESS,
      currency: 'XAF',
    });

    ledgerMock.getEscrowBalance.mockResolvedValue(300);

    await expect(
      service.requestRefundForTransaction('tx1', 400),
    ).rejects.toThrow(BadRequestException);
  });

  it('should mark refund refunded and debit refund ledger', async () => {
    prismaMock.refund.findUnique.mockResolvedValue({
      id: 'rf1',
      transactionId: 'tx1',
      status: RefundStatus.REQUESTED,
      amount: 1000,
      currency: 'XAF',
      externalReference: null,
      transaction: {
        id: 'tx1',
        amount: 1000,
        paymentStatus: PaymentStatus.SUCCESS,
      },
    });

    prismaMock.refund.update.mockResolvedValue({
      id: 'rf1',
      transactionId: 'tx1',
      status: RefundStatus.REFUNDED,
      amount: 1000,
      currency: 'XAF',
    });

    ledgerMock.addEntryIdempotent.mockResolvedValue({});
    ledgerMock.getEscrowBalance.mockResolvedValue(0);

    prismaMock.transaction.update.mockResolvedValue({
      id: 'tx1',
      escrowAmount: 0,
      paymentStatus: PaymentStatus.REFUNDED,
    });

    const result = await service.markRefunded('rf1', {
      externalReference: 'ext-rf1',
      note: 'refund completed',
      actorUserId: 'admin1',
    });

    expect(result.status).toBe(RefundStatus.REFUNDED);
    expect(ledgerMock.addEntryIdempotent).toHaveBeenCalled();
    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx1' },
      data: {
        escrowAmount: 0,
        paymentStatus: PaymentStatus.REFUNDED,
      },
    });
  });

  it('should keep payment status unchanged on partial refund', async () => {
    prismaMock.refund.findUnique.mockResolvedValue({
      id: 'rf1',
      transactionId: 'tx1',
      status: RefundStatus.REQUESTED,
      amount: 400,
      currency: 'XAF',
      externalReference: null,
      transaction: {
        id: 'tx1',
        amount: 1000,
        paymentStatus: PaymentStatus.SUCCESS,
      },
    });

    prismaMock.refund.update.mockResolvedValue({
      id: 'rf1',
      transactionId: 'tx1',
      status: RefundStatus.REFUNDED,
      amount: 400,
      currency: 'XAF',
    });

    ledgerMock.addEntryIdempotent.mockResolvedValue({});
    ledgerMock.getEscrowBalance.mockResolvedValue(600);

    prismaMock.transaction.update.mockResolvedValue({
      id: 'tx1',
      escrowAmount: 600,
      paymentStatus: PaymentStatus.SUCCESS,
    });

    const result = await service.markRefunded('rf1');

    expect(result.status).toBe(RefundStatus.REFUNDED);
    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx1' },
      data: {
        escrowAmount: 600,
        paymentStatus: PaymentStatus.SUCCESS,
      },
    });
  });

  it('should mark refund failed', async () => {
    prismaMock.refund.findUnique.mockResolvedValue({
      id: 'rf1',
      transactionId: 'tx1',
      status: RefundStatus.REQUESTED,
    });

    prismaMock.refund.update.mockResolvedValue({
      id: 'rf1',
      transactionId: 'tx1',
      status: RefundStatus.FAILED,
      failureReason: 'provider error',
    });

    const result = await service.markFailed('rf1', { reason: 'provider error' });

    expect(result.status).toBe(RefundStatus.FAILED);
  });
});