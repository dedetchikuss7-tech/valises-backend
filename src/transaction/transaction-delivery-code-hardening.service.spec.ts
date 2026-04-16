import { createHash } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  DisputeStatus,
  PaymentStatus,
  Role,
  TransactionStatus,
} from '@prisma/client';
import { TransactionService } from './transaction.service';

describe('TransactionService - delivery confirmation hardening', () => {
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

    service = new TransactionService(
      prisma as any,
      ledger as any,
      abandonment as any,
      payoutService as any,
    );
  });

  it('rejects delivery code generation for outsider sender access', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryConfirmedAt: null,
    });

    await expect(
      service.generateDeliveryCode('tx-1', 'outsider-1', Role.USER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects delivery code generation when transaction is DISPUTED', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      status: TransactionStatus.DISPUTED,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryConfirmedAt: null,
    });

    await expect(
      service.generateDeliveryCode('tx-1', 'sender-1', Role.USER),
    ).rejects.toThrow('Cannot generate delivery code: transaction is DISPUTED');
  });

  it('rejects delivery code generation when delivery is already confirmed', async () => {
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
    ).rejects.toThrow(
      'Cannot generate delivery code: delivery already confirmed',
    );
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
    ).rejects.toThrow(
      'Cannot generate delivery code: open dispute exists for this transaction',
    );
  });

  it('allows sender to generate delivery code when transaction is clean and paid', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryConfirmedAt: null,
    });

    prisma.dispute.findFirst.mockResolvedValue(null);
    prisma.transaction.update.mockResolvedValue(undefined);

    const result = await service.generateDeliveryCode(
      'tx-1',
      'sender-1',
      Role.USER,
    );

    expect(result.transactionId).toBe('tx-1');
    expect(result.code).toMatch(/^\d{6}$/);
    expect(result.generatedAt).toBeInstanceOf(Date);
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(prisma.transaction.update).toHaveBeenCalled();
  });

  it('rejects delivery confirmation for outsider traveler access', async () => {
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
      service.confirmDeliveryWithCode('tx-1', 'outsider-1', Role.USER, '123456'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects delivery confirmation when transaction is already DELIVERED', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      status: TransactionStatus.DELIVERED,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryCodeHash: 'hash',
      deliveryCodeSalt: 'salt',
      deliveryCodeGeneratedAt: new Date(),
      deliveryCodeExpiresAt: new Date(Date.now() + 60_000),
      deliveryCodeConsumedAt: null,
      deliveryConfirmedAt: new Date(),
      payout: null,
    });

    await expect(
      service.confirmDeliveryWithCode('tx-1', 'traveler-1', Role.USER, '123456'),
    ).rejects.toThrow('Delivery already confirmed for this transaction');
  });

  it('rejects delivery confirmation when transaction is DISPUTED', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      status: TransactionStatus.DISPUTED,
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
      service.confirmDeliveryWithCode('tx-1', 'traveler-1', Role.USER, '123456'),
    ).rejects.toThrow(
      'Cannot confirm delivery while transaction is DISPUTED',
    );
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
      deliveryCodeGeneratedAt: new Date(),
      deliveryCodeExpiresAt: new Date(Date.now() + 60_000),
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
    ).rejects.toThrow(
      'Cannot confirm delivery: open dispute exists for this transaction',
    );
  });

  it('rejects delivery confirmation when payout flow already started', async () => {
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
      deliveryCodeGeneratedAt: new Date(),
      deliveryCodeExpiresAt: new Date(Date.now() + 60_000),
      deliveryCodeConsumedAt: null,
      deliveryConfirmedAt: null,
      payout: {
        id: 'po-1',
        status: 'REQUESTED',
      },
    });

    prisma.dispute.findFirst.mockResolvedValue(null);

    await expect(
      service.confirmDeliveryWithCode('tx-1', 'traveler-1', Role.USER, code),
    ).rejects.toThrow(
      'Cannot confirm delivery: payout flow has already started for this transaction',
    );
  });

  it('rejects delivery confirmation when delivery code is invalid', async () => {
    const salt = 'salt-1';
    const storedCode = '123456';
    const providedCode = '654321';
    const hash = createHash('sha256')
      .update(`${storedCode}:${salt}`)
      .digest('hex');

    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryCodeHash: hash,
      deliveryCodeSalt: salt,
      deliveryCodeGeneratedAt: new Date(),
      deliveryCodeExpiresAt: new Date(Date.now() + 60_000),
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
        providedCode,
      ),
    ).rejects.toThrow('Invalid delivery code');
  });

  it('rejects delivery confirmation when delivery code already consumed', async () => {
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
      deliveryCodeGeneratedAt: new Date(),
      deliveryCodeExpiresAt: new Date(Date.now() + 60_000),
      deliveryCodeConsumedAt: new Date(),
      deliveryConfirmedAt: null,
      payout: null,
    });

    await expect(
      service.confirmDeliveryWithCode('tx-1', 'traveler-1', Role.USER, code),
    ).rejects.toThrow(
      'Delivery code has already been consumed for this transaction',
    );
  });

  it('rejects delivery confirmation when delivery code expired', async () => {
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
      deliveryCodeGeneratedAt: new Date(Date.now() - 120_000),
      deliveryCodeExpiresAt: new Date(Date.now() - 60_000),
      deliveryCodeConsumedAt: null,
      deliveryConfirmedAt: null,
      payout: null,
    });

    prisma.dispute.findFirst.mockResolvedValue(null);

    await expect(
      service.confirmDeliveryWithCode('tx-1', 'traveler-1', Role.USER, code),
    ).rejects.toThrow('Delivery code has expired');
  });

  it('confirms delivery atomically and triggers payout request', async () => {
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
      deliveryCodeGeneratedAt: new Date(),
      deliveryCodeExpiresAt: new Date(Date.now() + 60_000),
      deliveryCodeConsumedAt: null,
      deliveryConfirmedAt: null,
      payout: null,
    });

    prisma.dispute.findFirst.mockResolvedValue(null);
    prisma.transaction.updateMany.mockResolvedValue({ count: 1 });
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      status: TransactionStatus.DELIVERED,
      deliveryConfirmedAt: new Date('2026-04-20T10:00:00.000Z'),
      deliveryCodeConsumedAt: new Date('2026-04-20T10:00:00.000Z'),
    });

    payoutService.requestPayoutForTransaction.mockResolvedValue({
      id: 'po-1',
      status: 'REQUESTED',
    });

    const result = await service.confirmDeliveryWithCode(
      'tx-1',
      'traveler-1',
      Role.USER,
      code,
    );

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
    expect(result.status).toBe(TransactionStatus.DELIVERED);
    expect(result.payoutRequestTriggered).toBe(true);
    expect(result.payoutId).toBe('po-1');
    expect(result.payoutStatus).toBe('REQUESTED');
  });

  it('rejects confirmation when atomic update fails due to race/replay', async () => {
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
      deliveryCodeGeneratedAt: new Date(),
      deliveryCodeExpiresAt: new Date(Date.now() + 60_000),
      deliveryCodeConsumedAt: null,
      deliveryConfirmedAt: null,
      payout: null,
    });

    prisma.dispute.findFirst.mockResolvedValue(null);
    prisma.transaction.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.confirmDeliveryWithCode('tx-1', 'traveler-1', Role.USER, code),
    ).rejects.toThrow(
      'Delivery confirmation could not be completed because the delivery code is no longer active',
    );

    expect(payoutService.requestPayoutForTransaction).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when transaction does not exist for generation', async () => {
    prisma.transaction.findFirst.mockResolvedValue(null);

    await expect(
      service.generateDeliveryCode('missing-tx', 'sender-1', Role.USER),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when transaction does not exist for confirmation', async () => {
    prisma.transaction.findFirst.mockResolvedValue(null);

    await expect(
      service.confirmDeliveryWithCode(
        'missing-tx',
        'traveler-1',
        Role.USER,
        '123456',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects malformed delivery code input', async () => {
    await expect(
      service.confirmDeliveryWithCode('tx-1', 'traveler-1', Role.USER, '12A456'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});