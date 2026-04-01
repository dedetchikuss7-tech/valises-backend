import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
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
    });

    await expect(
      service.generateDeliveryCode('tx-1', 'sender-1', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('confirms delivery with valid code for traveler on PAID transaction and triggers payout request', async () => {
    const serviceAsAny = service as any;
    const salt = 'salt-1';
    const code = '123456';
    const hash = serviceAsAny.buildDeliveryCodeHash(code, salt);

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
    });

    prisma.transaction.update.mockResolvedValue({
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

    expect(result).toEqual({
      transactionId: 'tx-1',
      status: TransactionStatus.DELIVERED,
      deliveryConfirmedAt: new Date('2026-04-01T12:00:00.000Z'),
      deliveryCodeConsumedAt: new Date('2026-04-01T12:00:00.000Z'),
      payoutRequestTriggered: true,
      payoutId: 'po-1',
      payoutStatus: PayoutStatus.REQUESTED,
    });

    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      data: expect.objectContaining({
        status: TransactionStatus.DELIVERED,
        deliveryConfirmedAt: expect.any(Date),
        deliveryCodeConsumedAt: expect.any(Date),
      }),
      select: {
        id: true,
        status: true,
        deliveryConfirmedAt: true,
        deliveryCodeConsumedAt: true,
      },
    });

    expect(payoutService.requestPayoutForTransaction).toHaveBeenCalledWith(
      'tx-1',
    );
  });

  it('rejects delivery confirmation with invalid code', async () => {
    const serviceAsAny = service as any;
    const salt = 'salt-1';
    const hash = serviceAsAny.buildDeliveryCodeHash('123456', salt);

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
    });

    await expect(
      service.confirmDeliveryWithCode(
        'tx-1',
        'traveler-1',
        Role.USER,
        '000000',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects delivery confirmation when code was already consumed', async () => {
    const serviceAsAny = service as any;
    const salt = 'salt-1';
    const hash = serviceAsAny.buildDeliveryCodeHash('123456', salt);

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

  it('rejects delivery confirmation for non-traveler non-admin', async () => {
    const serviceAsAny = service as any;
    const salt = 'salt-1';
    const hash = serviceAsAny.buildDeliveryCodeHash('123456', salt);

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
    });

    await expect(
      service.confirmDeliveryWithCode('tx-1', 'sender-1', Role.USER, '123456'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});