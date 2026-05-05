import { BadRequestException } from '@nestjs/common';
import { PayoutProvider, PayoutStatus } from '@prisma/client';

import { PayoutService } from './payout.service';

describe('PayoutLifecycleHardening', () => {
  let service: PayoutService;

  const prismaMock = {
    transaction: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payout: {
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
    provider: PayoutProvider.MANUAL,
    requestPayout: jest.fn(),
  };

  const mockStripeProviderMock = {
    provider: PayoutProvider.MOCK_STRIPE,
    requestPayout: jest.fn(),
  };

  const adminActionAuditMock = {
    recordSafe: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(async (callback: any) =>
      callback({
        payout: {
          update: prismaMock.payout.update,
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

    service = new PayoutService(
      prismaMock as any,
      ledgerMock as any,
      manualProviderMock as any,
      mockStripeProviderMock as any,
      adminActionAuditMock as any,
    );
  });

  it('rejects retry when payout is REQUESTED', async () => {
    prismaMock.payout.findUnique.mockResolvedValue({
      id: 'po-requested',
      transactionId: 'tx1',
      provider: PayoutProvider.MANUAL,
      status: PayoutStatus.REQUESTED,
      amount: 850,
      currency: 'XAF',
    });

    await expect(
      service.retry('po-requested', {
        provider: PayoutProvider.MANUAL,
        reason: 'not failed',
        actorUserId: 'admin1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.payout.update).not.toHaveBeenCalled();
    expect(manualProviderMock.requestPayout).not.toHaveBeenCalled();
  });

  it('rejects retry when payout is CANCELLED', async () => {
    prismaMock.payout.findUnique.mockResolvedValue({
      id: 'po-cancelled',
      transactionId: 'tx1',
      provider: PayoutProvider.MANUAL,
      status: PayoutStatus.CANCELLED,
      amount: 850,
      currency: 'XAF',
    });

    await expect(
      service.retry('po-cancelled', {
        provider: PayoutProvider.MANUAL,
        reason: 'cancelled is terminal',
        actorUserId: 'admin1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.payout.update).not.toHaveBeenCalled();
    expect(manualProviderMock.requestPayout).not.toHaveBeenCalled();
  });

  it('keeps markPaid idempotent when payout is already PAID', async () => {
    const payout = {
      id: 'po-paid',
      transactionId: 'tx1',
      provider: PayoutProvider.MANUAL,
      status: PayoutStatus.PAID,
      amount: 850,
      currency: 'XAF',
    };

    prismaMock.payout.findUnique.mockResolvedValue(payout);

    const result = await service.markPaid('po-paid', {
      externalReference: 'manual:po-paid',
      note: 'already paid',
      actorUserId: 'admin1',
    });

    expect(result).toEqual(payout);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(ledgerMock.addEntryIdempotent).not.toHaveBeenCalled();
  });

  it('rejects markPaid when payout is FAILED', async () => {
    prismaMock.payout.findUnique.mockResolvedValue({
      id: 'po-failed',
      transactionId: 'tx1',
      provider: PayoutProvider.MANUAL,
      status: PayoutStatus.FAILED,
      amount: 850,
      currency: 'XAF',
      transaction: {
        id: 'tx1',
        paymentStatus: 'SUCCESS',
        currency: 'XAF',
      },
    });

    await expect(
      service.markPaid('po-failed', {
        externalReference: 'manual:po-failed',
        note: 'failed must retry first',
        actorUserId: 'admin1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(ledgerMock.addEntryIdempotent).not.toHaveBeenCalled();
  });

  it('rejects markFailed when payout is already FAILED', async () => {
    prismaMock.payout.findUnique.mockResolvedValue({
      id: 'po-failed',
      transactionId: 'tx1',
      provider: PayoutProvider.MANUAL,
      status: PayoutStatus.FAILED,
      amount: 850,
      currency: 'XAF',
    });

    await expect(
      service.markFailed('po-failed', {
        reason: 'already failed',
        actorUserId: 'admin1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.payout.update).not.toHaveBeenCalled();
  });
});