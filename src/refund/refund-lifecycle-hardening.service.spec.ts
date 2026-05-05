import { BadRequestException } from '@nestjs/common';
import { RefundProvider, RefundStatus } from '@prisma/client';
import { RefundService } from './refund.service';

describe('RefundLifecycleHardening', () => {
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
    getBalances: jest.fn(),
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
        ledgerEntry: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
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

  it('rejects retry when refund is REQUESTED', async () => {
    prismaMock.refund.findUnique.mockResolvedValue({
      id: 'rf-requested',
      transactionId: 'tx1',
      provider: RefundProvider.MANUAL,
      status: RefundStatus.REQUESTED,
      amount: 400,
      currency: 'XAF',
    });

    await expect(
      service.retry('rf-requested', {
        provider: RefundProvider.MANUAL,
        reason: 'not failed',
        actorUserId: 'admin1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.refund.update).not.toHaveBeenCalled();
    expect(manualProviderMock.requestRefund).not.toHaveBeenCalled();
  });

  it('rejects retry when refund is CANCELLED', async () => {
    prismaMock.refund.findUnique.mockResolvedValue({
      id: 'rf-cancelled',
      transactionId: 'tx1',
      provider: RefundProvider.MANUAL,
      status: RefundStatus.CANCELLED,
      amount: 400,
      currency: 'XAF',
    });

    await expect(
      service.retry('rf-cancelled', {
        provider: RefundProvider.MANUAL,
        reason: 'cancelled is terminal',
        actorUserId: 'admin1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.refund.update).not.toHaveBeenCalled();
    expect(manualProviderMock.requestRefund).not.toHaveBeenCalled();
  });

  it('rejects markRefunded when refund is already REFUNDED', async () => {
    prismaMock.refund.findUnique.mockResolvedValue({
      id: 'rf-refunded',
      transactionId: 'tx1',
      provider: RefundProvider.MANUAL,
      status: RefundStatus.REFUNDED,
      amount: 400,
      currency: 'XAF',
    });

    await expect(
      service.markRefunded('rf-refunded', {
        externalReference: 'manual_refund:rf-refunded',
        note: 'already refunded',
        actorUserId: 'admin1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects markRefunded when refund is FAILED', async () => {
    prismaMock.refund.findUnique.mockResolvedValue({
      id: 'rf-failed',
      transactionId: 'tx1',
      provider: RefundProvider.MANUAL,
      status: RefundStatus.FAILED,
      amount: 400,
      currency: 'XAF',
      transaction: {
        id: 'tx1',
        paymentStatus: 'SUCCESS',
        currency: 'XAF',
      },
    });

    await expect(
      service.markRefunded('rf-failed', {
        externalReference: 'manual_refund:rf-failed',
        note: 'failed must retry first',
        actorUserId: 'admin1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(ledgerMock.addEntryIdempotent).not.toHaveBeenCalled();
  });

  it('rejects markFailed when refund is already FAILED', async () => {
    prismaMock.refund.findUnique.mockResolvedValue({
      id: 'rf-failed',
      transactionId: 'tx1',
      provider: RefundProvider.MANUAL,
      status: RefundStatus.FAILED,
      amount: 400,
      currency: 'XAF',
    });

    await expect(
      service.markFailed('rf-failed', {
        reason: 'already failed',
        actorUserId: 'admin1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.refund.update).not.toHaveBeenCalled();
  });
});