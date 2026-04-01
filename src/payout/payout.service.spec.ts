import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PaymentStatus,
  PayoutProvider,
  PayoutStatus,
  TransactionStatus,
} from '@prisma/client';
import { PayoutService } from './payout.service';

describe('PayoutService', () => {
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

    prismaMock.$transaction.mockImplementation(async (cb: any) =>
      cb({
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

  it('should request payout for transaction and dispatch to provider', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      status: TransactionStatus.DELIVERED,
      paymentStatus: PaymentStatus.SUCCESS,
      escrowAmount: 1000,
      currency: 'XAF',
    });

    ledgerMock.getBalances.mockResolvedValue({
      escrowBalance: 1000,
      commissionBalance: 100,
      reserveBalance: 50,
      releasableAmount: 850,
    });

    prismaMock.payout.findUnique.mockResolvedValue(null);

    prismaMock.payout.create.mockResolvedValue({
      id: 'po1',
      transactionId: 'tx1',
      provider: PayoutProvider.MANUAL,
      status: PayoutStatus.READY,
      amount: 850,
      currency: 'XAF',
    });

    manualProviderMock.requestPayout.mockResolvedValue({
      status: 'REQUESTED',
      externalReference: 'manual:po1',
      metadata: { mode: 'manual' },
    });

    prismaMock.payout.update.mockResolvedValue({
      id: 'po1',
      transactionId: 'tx1',
      provider: PayoutProvider.MANUAL,
      status: PayoutStatus.REQUESTED,
      amount: 850,
      currency: 'XAF',
      externalReference: 'manual:po1',
    });

    const result = await service.requestPayoutForTransaction('tx1');

    expect(result.status).toBe(PayoutStatus.REQUESTED);
    expect(prismaMock.payout.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        transactionId: 'tx1',
        amount: 850,
        currency: 'XAF',
      }),
    });
    expect(manualProviderMock.requestPayout).toHaveBeenCalled();
    expect(adminActionAuditMock.recordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PAYOUT_REQUESTED',
        targetType: 'PAYOUT',
        targetId: 'po1',
      }),
    );
  });

  it('should reject payout request if transaction not found', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);

    await expect(service.requestPayoutForTransaction('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should reject payout request if transaction status is not DELIVERED or DISPUTED', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      status: TransactionStatus.IN_TRANSIT,
      paymentStatus: PaymentStatus.SUCCESS,
      escrowAmount: 1000,
      currency: 'XAF',
    });

    await expect(service.requestPayoutForTransaction('tx1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject payout request if payment is not SUCCESS', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      status: TransactionStatus.DELIVERED,
      paymentStatus: PaymentStatus.PENDING,
      escrowAmount: 1000,
      currency: 'XAF',
    });

    await expect(service.requestPayoutForTransaction('tx1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject payout request if escrow is zero', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      status: TransactionStatus.DELIVERED,
      paymentStatus: PaymentStatus.SUCCESS,
      escrowAmount: 0,
      currency: 'XAF',
    });

    ledgerMock.getBalances.mockResolvedValue({
      escrowBalance: 0,
      commissionBalance: 0,
      reserveBalance: 0,
      releasableAmount: 0,
    });

    await expect(service.requestPayoutForTransaction('tx1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject payout request if releasable amount is zero', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      status: TransactionStatus.DELIVERED,
      paymentStatus: PaymentStatus.SUCCESS,
      escrowAmount: 1000,
      currency: 'XAF',
    });

    ledgerMock.getBalances.mockResolvedValue({
      escrowBalance: 1000,
      commissionBalance: 700,
      reserveBalance: 300,
      releasableAmount: 0,
    });

    await expect(service.requestPayoutForTransaction('tx1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject payout request if explicit amount exceeds releasable amount', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx1',
      status: TransactionStatus.DELIVERED,
      paymentStatus: PaymentStatus.SUCCESS,
      escrowAmount: 1000,
      currency: 'XAF',
    });

    ledgerMock.getBalances.mockResolvedValue({
      escrowBalance: 1000,
      commissionBalance: 100,
      reserveBalance: 50,
      releasableAmount: 850,
    });

    await expect(
      service.requestPayoutForTransaction('tx1', PayoutProvider.MANUAL, {
        amount: 900,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should mark payout paid and debit release ledger', async () => {
    prismaMock.payout.findUnique.mockResolvedValue({
      id: 'po1',
      transactionId: 'tx1',
      status: PayoutStatus.REQUESTED,
      amount: 700,
      currency: 'XAF',
      externalReference: null,
      transaction: {
        id: 'tx1',
        status: TransactionStatus.DISPUTED,
        paymentStatus: PaymentStatus.SUCCESS,
      },
    });

    prismaMock.payout.update.mockResolvedValue({
      id: 'po1',
      transactionId: 'tx1',
      status: PayoutStatus.PAID,
      amount: 700,
      currency: 'XAF',
    });

    ledgerMock.addEntryIdempotent.mockResolvedValue({});
    ledgerMock.getBalances.mockResolvedValue({
      escrowBalance: 300,
      commissionBalance: 100,
      reserveBalance: 50,
      releasableAmount: 150,
    });

    prismaMock.transaction.update.mockResolvedValue({
      id: 'tx1',
      escrowAmount: 300,
    });

    const result = await service.markPaid('po1', {
      externalReference: 'ext-po1',
      note: 'paid manually',
      actorUserId: 'admin1',
    });

    expect(result.status).toBe(PayoutStatus.PAID);
    expect(ledgerMock.addEntryIdempotent).toHaveBeenCalled();
    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx1' },
      data: { escrowAmount: 300 },
    });
  });

  it('should return payout if already paid', async () => {
    prismaMock.payout.findUnique.mockResolvedValue({
      id: 'po1',
      transactionId: 'tx1',
      status: PayoutStatus.PAID,
      amount: 700,
      currency: 'XAF',
      transaction: {
        id: 'tx1',
        status: TransactionStatus.DISPUTED,
        paymentStatus: PaymentStatus.SUCCESS,
      },
    });

    const result = await service.markPaid('po1');

    expect(result.status).toBe(PayoutStatus.PAID);
  });

  it('should mark payout failed', async () => {
    prismaMock.payout.findUnique.mockResolvedValue({
      id: 'po1',
      transactionId: 'tx1',
      status: PayoutStatus.REQUESTED,
    });

    prismaMock.payout.update.mockResolvedValue({
      id: 'po1',
      transactionId: 'tx1',
      status: PayoutStatus.FAILED,
      failureReason: 'provider error',
    });

    const result = await service.markFailed('po1', { reason: 'provider error' });

    expect(result.status).toBe(PayoutStatus.FAILED);
    expect(prismaMock.payout.update).toHaveBeenCalled();
  });
});