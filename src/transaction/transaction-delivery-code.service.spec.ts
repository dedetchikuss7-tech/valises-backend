import { createHash } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  DisputeStatus,
  PaymentStatus,
  PayoutStatus,
  Role,
  TransactionStatus,
} from '@prisma/client';
import { TransactionService } from './transaction.service';

describe('TransactionService - delivery code flow', () => {
  let service: TransactionService;

  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    transaction: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    refund: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    dispute: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    corridorPricingPaymentConfig: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const ledger = {
    getEscrowBalance: jest.fn(),
    createEntry: jest.fn(),
    addEntryIdempotent: jest.fn(),
    listByTransaction: jest.fn(),
  };

  const abandonment = {
    markAbandoned: jest.fn(),
    resolveActiveByReference: jest.fn(),
  };

  const payoutService = {
    requestPayoutForTransaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.refund.findMany.mockResolvedValue([]);
    prisma.dispute.findMany.mockResolvedValue([]);
    prisma.dispute.findFirst.mockResolvedValue(null);

    service = new TransactionService(
      prisma as any,
      ledger as any,
      abandonment as any,
      payoutService as any,
    );
  });

  it('generates a 6-digit delivery code for sender on PAID transaction', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryConfirmedAt: null,
    });

    prisma.transaction.update.mockImplementation(async ({ where, data }: any) => ({
      id: where.id,
      ...data,
    }));

    const result = await service.generateDeliveryCode(
      'tx-1',
      'sender-1',
      Role.USER,
    );

    expect(result.transactionId).toBe('tx-1');
    expect(result.code).toMatch(/^\d{6}$/);
    expect(prisma.dispute.findFirst).toHaveBeenCalledWith({
      where: {
        transactionId: 'tx-1',
        status: DisputeStatus.OPEN,
      },
      select: { id: true },
    });
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      data: expect.objectContaining({
        deliveryCodeHash: expect.any(String),
        deliveryCodeSalt: expect.any(String),
        deliveryCodeGeneratedAt: expect.any(Date),
        deliveryCodeExpiresAt: expect.any(Date),
        deliveryCodeConsumedAt: null,
        deliveryConfirmedAt: null,
      }),
    });
  });

  it('rejects delivery code generation when transaction is not visible', async () => {
    prisma.transaction.findFirst.mockResolvedValue(null);

    await expect(
      service.generateDeliveryCode('missing', 'sender-1', Role.USER),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects delivery code generation for non-sender non-admin', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryConfirmedAt: null,
    });

    await expect(
      service.generateDeliveryCode('tx-1', 'traveler-1', Role.USER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects delivery code generation when transaction is not PAID', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      status: TransactionStatus.CREATED,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryConfirmedAt: null,
    });

    await expect(
      service.generateDeliveryCode('tx-1', 'sender-1', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects delivery code generation when open dispute exists', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryConfirmedAt: null,
    });

    prisma.dispute.findFirst.mockResolvedValue({
      id: 'dp-1',
      status: DisputeStatus.OPEN,
    });

    await expect(
      service.generateDeliveryCode('tx-1', 'sender-1', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects delivery code generation when delivery already confirmed', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      status: TransactionStatus.DELIVERED,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryConfirmedAt: new Date('2026-04-20T10:00:00.000Z'),
    });

    await expect(
      service.generateDeliveryCode('tx-1', 'sender-1', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('confirms delivery with valid code for traveler on PAID transaction and triggers payout request', async () => {
    const salt = 'salt-1';
    const code = '123456';
    const hash = createHash('sha256').update(`${code}:${salt}`).digest('hex');

    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryCodeHash: hash,
      deliveryCodeSalt: salt,
      deliveryCodeGeneratedAt: new Date('2026-04-01T10:00:00.000Z'),
      deliveryCodeExpiresAt: new Date('2099-04-01T10:00:00.000Z'),
      deliveryCodeConsumedAt: null,
      deliveryConfirmedAt: null,
      payout: null,
    });

    prisma.dispute.findFirst.mockResolvedValue(null);

    prisma.transaction.updateMany.mockResolvedValue({ count: 1 });
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      status: TransactionStatus.DELIVERED,
      deliveryConfirmedAt: new Date('2026-04-01T12:00:00.000Z'),
      deliveryCodeConsumedAt: new Date('2026-04-01T12:00:00.000Z'),
    });

    payoutService.requestPayoutForTransaction.mockResolvedValue({
      id: 'po-1',
      status: PayoutStatus.REQUESTED,
    });

    const result = await service.confirmDeliveryWithCode(
      'tx-1',
      'traveler-1',
      Role.USER,
      code,
    );

    expect(prisma.dispute.findFirst).toHaveBeenCalledWith({
      where: {
        transactionId: 'tx-1',
        status: DisputeStatus.OPEN,
      },
      select: { id: true },
    });

    expect(prisma.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'tx-1',
          status: TransactionStatus.PAID,
          paymentStatus: PaymentStatus.SUCCESS,
          deliveryCodeConsumedAt: null,
          deliveryConfirmedAt: null,
        }),
      }),
    );

    expect(payoutService.requestPayoutForTransaction).toHaveBeenCalledWith(
      'tx-1',
    );

    expect(result).toEqual({
      transactionId: 'tx-1',
      status: TransactionStatus.DELIVERED,
      deliveryConfirmedAt: new Date('2026-04-01T12:00:00.000Z'),
      deliveryCodeConsumedAt: new Date('2026-04-01T12:00:00.000Z'),
      payoutRequestTriggered: true,
      payoutId: 'po-1',
      payoutStatus: PayoutStatus.REQUESTED,
    });
  });

  it('rejects delivery confirmation when transaction is not visible', async () => {
    prisma.transaction.findFirst.mockResolvedValue(null);

    await expect(
      service.confirmDeliveryWithCode(
        'missing',
        'traveler-1',
        Role.USER,
        '123456',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects delivery confirmation for non-traveler non-admin', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryCodeHash: 'hash',
      deliveryCodeSalt: 'salt',
      deliveryCodeGeneratedAt: new Date(),
      deliveryCodeExpiresAt: new Date(Date.now() + 60_000),
      deliveryCodeConsumedAt: null,
      deliveryConfirmedAt: null,
      payout: null,
    });

    await expect(
      service.confirmDeliveryWithCode('tx-1', 'sender-1', Role.USER, '123456'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects delivery confirmation when transaction is not PAID', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      status: TransactionStatus.CREATED,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryCodeHash: 'hash',
      deliveryCodeSalt: 'salt',
      deliveryCodeGeneratedAt: new Date(),
      deliveryCodeExpiresAt: new Date(Date.now() + 60_000),
      deliveryCodeConsumedAt: null,
      deliveryConfirmedAt: null,
      payout: null,
    });

    await expect(
      service.confirmDeliveryWithCode(
        'tx-1',
        'traveler-1',
        Role.USER,
        '123456',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects delivery confirmation with invalid code', async () => {
    const salt = 'salt-1';
    const realCode = '123456';
    const wrongCode = '000000';
    const hash = createHash('sha256')
      .update(`${realCode}:${salt}`)
      .digest('hex');

    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryCodeHash: hash,
      deliveryCodeSalt: salt,
      deliveryCodeGeneratedAt: new Date('2026-04-01T10:00:00.000Z'),
      deliveryCodeExpiresAt: new Date('2099-04-01T10:00:00.000Z'),
      deliveryCodeConsumedAt: null,
      deliveryConfirmedAt: null,
      payout: null,
    });

    prisma.dispute.findFirst.mockResolvedValue(null);

    await expect(
      service.confirmDeliveryWithCode(
        'tx-1',
        'traveler-1',
        Role.USER,
        wrongCode,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects delivery confirmation when code was already consumed', async () => {
    const salt = 'salt-1';
    const code = '123456';
    const hash = createHash('sha256').update(`${code}:${salt}`).digest('hex');

    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryCodeHash: hash,
      deliveryCodeSalt: salt,
      deliveryCodeGeneratedAt: new Date('2026-04-01T10:00:00.000Z'),
      deliveryCodeExpiresAt: new Date('2099-04-01T10:00:00.000Z'),
      deliveryCodeConsumedAt: new Date('2026-04-01T11:00:00.000Z'),
      deliveryConfirmedAt: null,
      payout: null,
    });

    await expect(
      service.confirmDeliveryWithCode('tx-1', 'traveler-1', Role.USER, code),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects delivery confirmation when open dispute exists', async () => {
    const salt = 'salt-1';
    const code = '123456';
    const hash = createHash('sha256').update(`${code}:${salt}`).digest('hex');

    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryCodeHash: hash,
      deliveryCodeSalt: salt,
      deliveryCodeGeneratedAt: new Date('2026-04-01T10:00:00.000Z'),
      deliveryCodeExpiresAt: new Date('2099-04-01T10:00:00.000Z'),
      deliveryCodeConsumedAt: null,
      deliveryConfirmedAt: null,
      payout: null,
    });

    prisma.dispute.findFirst.mockResolvedValue({
      id: 'dp-1',
      status: DisputeStatus.OPEN,
    });

    await expect(
      service.confirmDeliveryWithCode('tx-1', 'traveler-1', Role.USER, code),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});