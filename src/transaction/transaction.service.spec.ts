import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  DisputeOpeningSource,
  DisputeReasonCode,
  DisputeStatus,
  KycStatus,
  PaymentStatus,
  RefundProvider,
  RefundStatus,
  Role,
  TransactionStatus,
} from '@prisma/client';
import { TransactionService } from './transaction.service';

describe('TransactionService - automatic pricing on create', () => {
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

  const senderId = 'sender-1';
  const tripId = 'trip-1';
  const packageId = 'package-1';
  const corridorId = 'corridor-1';
  const travelerId = 'traveler-1';

  const dto = {
    tripId,
    packageId,
  };

  const buildDbTx = (options?: {
    packageWeightKg?: number;
    settlementCurrency?: string;
    senderPricePerKg?: number | null;
    senderPriceBundle23kg?: number | null;
    senderPriceBundle32kg?: number | null;
    pricingIsActive?: boolean;
    pricingIsVisible?: boolean;
    pricingIsBookable?: boolean;
    pricingRequiresManualReview?: boolean;
    pricingConfigExists?: boolean;
  }) => {
    const {
      packageWeightKg = 10,
      settlementCurrency = 'EUR',
      senderPricePerKg = 11.5,
      senderPriceBundle23kg = 185,
      senderPriceBundle32kg = 210,
      pricingIsActive = true,
      pricingIsVisible = true,
      pricingIsBookable = true,
      pricingRequiresManualReview = false,
      pricingConfigExists = true,
    } = options ?? {};

    return {
      trip: {
        findUnique: jest.fn().mockResolvedValue({
          id: tripId,
          status: 'ACTIVE',
          carrierId: travelerId,
          corridorId,
        }),
      },
      package: {
        findUnique: jest.fn().mockResolvedValue({
          id: packageId,
          senderId,
          status: 'PUBLISHED',
          corridorId,
          weightKg: packageWeightKg,
          contentComplianceStatus: 'DECLARED_CLEAR',
        }),
        update: jest.fn().mockResolvedValue({
          id: packageId,
          status: 'RESERVED',
        }),
      },
      transaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'tx-1',
            senderId: data.senderId,
            travelerId: data.travelerId,
            tripId: data.tripId,
            packageId: data.packageId,
            corridorId: data.corridorId,
            amount: data.amount,
            commission: data.commission,
            escrowAmount: data.escrowAmount,
            currency: data.currency,
            status: data.status,
            paymentStatus: data.paymentStatus,
          }),
        ),
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
      corridor: {
        findUnique: jest.fn().mockResolvedValue({
          id: corridorId,
          code: 'FR_CM',
        }),
      },
      corridorPricingPaymentConfig: {
        findUnique: jest.fn().mockResolvedValue(
          pricingConfigExists
            ? {
                settlementCurrency,
                senderPricePerKg,
                senderPriceBundle23kg,
                senderPriceBundle32kg,
                isActive: pricingIsActive,
                isVisible: pricingIsVisible,
                isBookable: pricingIsBookable,
                requiresManualReview: pricingRequiresManualReview,
              }
            : null,
        ),
      },
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.user.findUnique.mockResolvedValue({ id: senderId });
    prisma.refund.findMany.mockResolvedValue([]);
    prisma.dispute.findMany.mockResolvedValue([]);
    abandonment.markAbandoned.mockResolvedValue(undefined);
    abandonment.resolveActiveByReference.mockResolvedValue(undefined);

    service = new TransactionService(
      prisma as any,
      ledger as any,
      abandonment as any,
      payoutService as any,
    );
  });

  it('uses senderPriceBundle23kg when package weight is 23kg', async () => {
    const dbTx = buildDbTx({
      packageWeightKg: 23,
      settlementCurrency: 'EUR',
      senderPricePerKg: 11.5,
      senderPriceBundle23kg: 185,
      senderPriceBundle32kg: 210,
      pricingIsVisible: true,
      pricingIsBookable: true,
      pricingRequiresManualReview: false,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback(dbTx),
    );

    const result = await service.create(senderId, dto);

    expect(result.transaction.amount).toBe(185);
    expect(result.transaction.currency).toBe('EUR');
    expect(result.transaction.status).toBe(TransactionStatus.CREATED);
    expect(result.transaction.paymentStatus).toBe(PaymentStatus.PENDING);

    expect(result.pricingDetails).toEqual({
      corridorCode: 'FR_CM',
      weightKg: 23,
      pricingModelApplied: 'BUNDLE_23KG',
      computedAmount: 185,
      settlementCurrency: 'EUR',
      senderPricePerKg: 11.5,
      senderPriceBundle23kg: 185,
      senderPriceBundle32kg: 210,
    });

    expect(dbTx.package.update).toHaveBeenCalledWith({
      where: { id: packageId },
      data: { status: 'RESERVED' },
    });
  });

  it('uses senderPriceBundle32kg when package weight is 32kg', async () => {
    const dbTx = buildDbTx({
      packageWeightKg: 32,
      settlementCurrency: 'EUR',
      senderPricePerKg: 11.5,
      senderPriceBundle23kg: 185,
      senderPriceBundle32kg: 210,
      pricingIsVisible: true,
      pricingIsBookable: true,
      pricingRequiresManualReview: false,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback(dbTx),
    );

    const result = await service.create(senderId, dto);

    expect(result.transaction.amount).toBe(210);
    expect(result.pricingDetails.pricingModelApplied).toBe('BUNDLE_32KG');
    expect(result.pricingDetails.computedAmount).toBe(210);
  });

  it('uses senderPricePerKg * weightKg for standard weights', async () => {
    const dbTx = buildDbTx({
      packageWeightKg: 10,
      settlementCurrency: 'EUR',
      senderPricePerKg: 11.5,
      senderPriceBundle23kg: 185,
      senderPriceBundle32kg: 210,
      pricingIsVisible: true,
      pricingIsBookable: true,
      pricingRequiresManualReview: false,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback(dbTx),
    );

    const result = await service.create(senderId, dto);

    expect(result.transaction.amount).toBe(115);
    expect(result.pricingDetails.pricingModelApplied).toBe('PER_KG');
    expect(result.pricingDetails.computedAmount).toBe(115);
  });

  it('throws PRICING_CONFIG_NOT_FOUND when corridor pricing config does not exist', async () => {
    const dbTx = buildDbTx({
      packageWeightKg: 10,
      pricingConfigExists: false,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback(dbTx),
    );

    await expect(service.create(senderId, dto)).rejects.toMatchObject({
      response: {
        code: 'PRICING_CONFIG_NOT_FOUND',
        corridorCode: 'FR_CM',
      },
    });
  });

  it('throws PRICING_CONFIG_INACTIVE when corridor pricing config is inactive', async () => {
    const dbTx = buildDbTx({
      packageWeightKg: 10,
      pricingIsActive: false,
      pricingIsVisible: true,
      pricingIsBookable: true,
      pricingRequiresManualReview: false,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback(dbTx),
    );

    await expect(service.create(senderId, dto)).rejects.toMatchObject({
      response: {
        code: 'PRICING_CONFIG_INACTIVE',
        corridorCode: 'FR_CM',
      },
    });
  });

  it('throws PRICING_CONFIG_REQUIRES_MANUAL_REVIEW when pricing config requires manual review', async () => {
    const dbTx = buildDbTx({
      packageWeightKg: 23,
      settlementCurrency: 'EUR',
      senderPricePerKg: 11.5,
      senderPriceBundle23kg: 185,
      senderPriceBundle32kg: 210,
      pricingIsActive: true,
      pricingIsVisible: true,
      pricingIsBookable: true,
      pricingRequiresManualReview: true,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback(dbTx),
    );

    await expect(service.create(senderId, dto)).rejects.toMatchObject({
      response: {
        code: 'PRICING_CONFIG_REQUIRES_MANUAL_REVIEW',
        corridorCode: 'FR_CM',
      },
    });
  });

  it('throws LIMIT_EXCEEDED when XAF automatic amount is above the per-transaction limit', async () => {
    const dbTx = buildDbTx({
      packageWeightKg: 100,
      settlementCurrency: 'XAF',
      senderPricePerKg: 25000,
      senderPriceBundle23kg: 185,
      senderPriceBundle32kg: 210,
      pricingIsVisible: true,
      pricingIsBookable: true,
      pricingRequiresManualReview: false,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback(dbTx),
    );

    await expect(service.create(senderId, dto)).rejects.toMatchObject({
      response: {
        code: 'LIMIT_EXCEEDED',
        amount: 2500000,
        maxAllowed: 2000000,
      },
    });
  });

  it('throws when package weight is invalid', async () => {
    const dbTx = buildDbTx({
      packageWeightKg: 0,
      settlementCurrency: 'EUR',
      senderPricePerKg: 11.5,
      pricingIsVisible: true,
      pricingIsBookable: true,
      pricingRequiresManualReview: false,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback(dbTx),
    );

    await expect(service.create(senderId, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('TransactionService - KYC gating on payment success', () => {
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
    ledger.addEntryIdempotent.mockResolvedValue(undefined);
    abandonment.resolveActiveByReference.mockResolvedValue(undefined);
    abandonment.markAbandoned.mockResolvedValue(undefined);

    service = new TransactionService(
      prisma as any,
      ledger as any,
      abandonment as any,
      payoutService as any,
    );
  });

  it('returns existing transaction when payment is already SUCCESS', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      amount: 185,
      currency: 'EUR',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
      escrowAmount: 185,
    });

    const result = await service.markPayment('tx-1', PaymentStatus.SUCCESS);

    expect(result).toEqual({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      amount: 185,
      currency: 'EUR',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
      escrowAmount: 185,
    });
    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when transaction does not exist', async () => {
    prisma.transaction.findUnique.mockResolvedValue(null);

    await expect(
      service.markPayment('missing-tx', PaymentStatus.SUCCESS),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws standardized KYC_REQUIRED payload when traveler is not VERIFIED', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      amount: 185,
      currency: 'EUR',
      status: TransactionStatus.CREATED,
      paymentStatus: PaymentStatus.PENDING,
      escrowAmount: 0,
    });

    prisma.user.findUnique.mockResolvedValue({
      id: 'traveler-1',
      kycStatus: KycStatus.PENDING,
    });

    await expect(
      service.markPayment('tx-1', PaymentStatus.SUCCESS),
    ).rejects.toMatchObject({
      response: {
        code: 'KYC_REQUIRED',
        requiredFor: 'TRANSACTION_PAYMENT_SUCCESS_TRAVELER',
        requiredKycStatus: KycStatus.VERIFIED,
        nextStep: 'KYC',
        nextStepUrl: '/kyc',
        userId: 'traveler-1',
        kycStatus: KycStatus.PENDING,
      },
    });

    expect(prisma.transaction.update).not.toHaveBeenCalled();
    expect(ledger.addEntryIdempotent).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when traveler does not exist', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'missing-traveler',
      amount: 185,
      currency: 'EUR',
      status: TransactionStatus.CREATED,
      paymentStatus: PaymentStatus.PENDING,
      escrowAmount: 0,
    });

    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.markPayment('tx-1', PaymentStatus.SUCCESS),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws LIMIT_EXCEEDED after KYC passes for XAF transactions above threshold', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      amount: 2500001,
      currency: 'XAF',
      status: TransactionStatus.CREATED,
      paymentStatus: PaymentStatus.PENDING,
      escrowAmount: 0,
    });

    prisma.user.findUnique.mockResolvedValue({
      id: 'traveler-1',
      kycStatus: KycStatus.VERIFIED,
    });

    await expect(
      service.markPayment('tx-1', PaymentStatus.SUCCESS),
    ).rejects.toMatchObject({
      response: {
        code: 'LIMIT_EXCEEDED',
        amount: 2500001,
        maxAllowed: 2000000,
      },
    });
  });

  it('marks payment SUCCESS when traveler is VERIFIED and returns delivery code', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      amount: 185,
      currency: 'EUR',
      status: TransactionStatus.CREATED,
      paymentStatus: PaymentStatus.PENDING,
      escrowAmount: 0,
    });

    prisma.user.findUnique.mockResolvedValue({
      id: 'traveler-1',
      kycStatus: KycStatus.VERIFIED,
    });

    prisma.transaction.update
      .mockResolvedValueOnce({
        id: 'tx-1',
        senderId: 'sender-1',
        travelerId: 'traveler-1',
        amount: 185,
        currency: 'EUR',
        status: TransactionStatus.PAID,
        paymentStatus: PaymentStatus.SUCCESS,
        escrowAmount: 185,
      })
      .mockResolvedValueOnce({
        id: 'tx-1',
      });

    const result = await service.markPayment('tx-1', PaymentStatus.SUCCESS);

    expect(prisma.transaction.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'tx-1' },
      data: {
        paymentStatus: PaymentStatus.SUCCESS,
        status: TransactionStatus.PAID,
        escrowAmount: 185,
      },
    });

    expect(ledger.addEntryIdempotent).toHaveBeenCalledWith({
      transactionId: 'tx-1',
      type: 'ESCROW_CREDIT',
      amount: 185,
      currency: 'EUR',
      note: 'Payment confirmed: escrow credited',
      idempotencyKey: 'payment_success:tx-1',
      source: 'PAYMENT',
      referenceType: 'PAYMENT',
      referenceId: 'payment_success:tx-1',
      actorUserId: null,
    });

    expect(abandonment.resolveActiveByReference).toHaveBeenCalledWith({
      userId: 'sender-1',
      kind: 'PAYMENT_PENDING',
      transactionId: 'tx-1',
    });

    expect(result).toMatchObject({
      transaction: {
        id: 'tx-1',
        status: TransactionStatus.PAID,
        paymentStatus: PaymentStatus.SUCCESS,
      },
      deliveryCode: {
        code: expect.any(String),
        generatedAt: expect.any(Date),
        expiresAt: expect.any(Date),
      },
    });
  });
});

describe('TransactionService - updateStatus state machine enforcement', () => {
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

  it('allows a valid CREATED -> CANCELLED transition', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      status: TransactionStatus.CREATED,
      paymentStatus: PaymentStatus.PENDING,
    });

    prisma.transaction.update.mockResolvedValue({
      id: 'tx-1',
      status: TransactionStatus.CANCELLED,
    });

    const result = await service.updateStatus(
      'tx-1',
      TransactionStatus.CANCELLED,
    );

    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      data: { status: TransactionStatus.CANCELLED },
    });

    expect(result).toEqual({
      id: 'tx-1',
      status: TransactionStatus.CANCELLED,
    });
  });

  it('rejects generic cancellation for already paid transactions', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      status: TransactionStatus.PAID,
      paymentStatus: PaymentStatus.SUCCESS,
    });

    await expect(
      service.updateStatus('tx-1', TransactionStatus.CANCELLED),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an invalid CREATED -> DELIVERED transition', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      status: TransactionStatus.CREATED,
      paymentStatus: PaymentStatus.PENDING,
    });

    await expect(
      service.updateStatus('tx-1', TransactionStatus.DELIVERED),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a same-status transition', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      status: TransactionStatus.CREATED,
      paymentStatus: PaymentStatus.PENDING,
    });

    await expect(
      service.updateStatus('tx-1', TransactionStatus.CREATED),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when transaction does not exist', async () => {
    prisma.transaction.findUnique.mockResolvedValue(null);

    await expect(
      service.updateStatus('missing-tx', TransactionStatus.CANCELLED),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TransactionService - dedicated pre-departure cancellation', () => {
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

  it('allows sender to cancel a paid transaction before departure and creates manual refund request', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      amount: 185,
      escrowAmount: 185,
      currency: 'EUR',
      payout: null,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        transaction: {
          update: jest.fn().mockResolvedValue({
            id: 'tx-1',
            status: TransactionStatus.CANCELLED,
          }),
        },
        refund: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'rf-1',
            transactionId: 'tx-1',
            provider: RefundProvider.MANUAL,
            status: RefundStatus.REQUESTED,
            amount: 185,
            currency: 'EUR',
          }),
          update: jest.fn(),
        },
      }),
    );

    const result = await service.cancelBeforeDeparture(
      'tx-1',
      'sender-1',
      Role.USER,
    );

    expect(result.transaction.status).toBe(TransactionStatus.CANCELLED);
    expect(result.refund.status).toBe(RefundStatus.REQUESTED);
    expect(result.refundAmount).toBe(185);
  });

  it('allows traveler to cancel a paid transaction before departure and creates manual refund request', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      amount: 185,
      escrowAmount: 185,
      currency: 'EUR',
      payout: null,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        transaction: {
          update: jest.fn().mockResolvedValue({
            id: 'tx-1',
            status: TransactionStatus.CANCELLED,
          }),
        },
        refund: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'rf-2',
            transactionId: 'tx-1',
            provider: RefundProvider.MANUAL,
            status: RefundStatus.REQUESTED,
            amount: 185,
            currency: 'EUR',
          }),
          update: jest.fn(),
        },
      }),
    );

    const result = await service.cancelBeforeDepartureByTraveler(
      'tx-1',
      'traveler-1',
      Role.USER,
    );

    expect(result.transaction.status).toBe(TransactionStatus.CANCELLED);
    expect(result.refund.status).toBe(RefundStatus.REQUESTED);
    expect(result.refundAmount).toBe(185);
  });

  it('allows ADMIN to cancel before departure', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      amount: 185,
      escrowAmount: 185,
      currency: 'EUR',
      payout: null,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        transaction: {
          update: jest.fn().mockResolvedValue({
            id: 'tx-1',
            status: TransactionStatus.CANCELLED,
          }),
        },
        refund: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'rf-1',
            transactionId: 'tx-1',
            provider: RefundProvider.MANUAL,
            status: RefundStatus.REQUESTED,
            amount: 185,
            currency: 'EUR',
          }),
          update: jest.fn(),
        },
      }),
    );

    const result = await service.cancelBeforeDeparture(
      'tx-1',
      'admin-1',
      Role.ADMIN,
    );

    expect(result.transaction.status).toBe(TransactionStatus.CANCELLED);
    expect(result.refund.status).toBe(RefundStatus.REQUESTED);
  });

  it('allows ADMIN to trigger traveler-side pre-departure cancellation', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      amount: 185,
      escrowAmount: 185,
      currency: 'EUR',
      payout: null,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        transaction: {
          update: jest.fn().mockResolvedValue({
            id: 'tx-1',
            status: TransactionStatus.CANCELLED,
          }),
        },
        refund: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'rf-2',
            transactionId: 'tx-1',
            provider: RefundProvider.MANUAL,
            status: RefundStatus.REQUESTED,
            amount: 185,
            currency: 'EUR',
          }),
          update: jest.fn(),
        },
      }),
    );

    const result = await service.cancelBeforeDepartureByTraveler(
      'tx-1',
      'admin-1',
      Role.ADMIN,
    );

    expect(result.transaction.status).toBe(TransactionStatus.CANCELLED);
    expect(result.refund.status).toBe(RefundStatus.REQUESTED);
  });

  it('rejects outsider sender-side cancellation', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      amount: 185,
      escrowAmount: 185,
      currency: 'EUR',
      payout: null,
    });

    await expect(
      service.cancelBeforeDeparture('tx-1', 'outsider-1', Role.USER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects outsider traveler-side cancellation', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      amount: 185,
      escrowAmount: 185,
      currency: 'EUR',
      payout: null,
    });

    await expect(
      service.cancelBeforeDepartureByTraveler('tx-1', 'outsider-1', Role.USER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects sender-side cancellation when transaction is not paid', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: PaymentStatus.PENDING,
      status: TransactionStatus.CREATED,
      amount: 185,
      escrowAmount: 0,
      currency: 'EUR',
      payout: null,
    });

    await expect(
      service.cancelBeforeDeparture('tx-1', 'sender-1', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects traveler-side cancellation when transaction is not paid', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: PaymentStatus.PENDING,
      status: TransactionStatus.CREATED,
      amount: 185,
      escrowAmount: 0,
      currency: 'EUR',
      payout: null,
    });

    await expect(
      service.cancelBeforeDepartureByTraveler('tx-1', 'traveler-1', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects sender-side cancellation when transaction is no longer in PAID status', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.DELIVERED,
      amount: 185,
      escrowAmount: 185,
      currency: 'EUR',
      payout: null,
    });

    await expect(
      service.cancelBeforeDeparture('tx-1', 'sender-1', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects traveler-side cancellation when transaction is no longer in PAID status', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.DELIVERED,
      amount: 185,
      escrowAmount: 185,
      currency: 'EUR',
      payout: null,
    });

    await expect(
      service.cancelBeforeDepartureByTraveler('tx-1', 'traveler-1', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects sender-side cancellation when payout flow has already started', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      amount: 185,
      escrowAmount: 185,
      currency: 'EUR',
      payout: {
        id: 'po-1',
        status: 'REQUESTED',
      },
    });

    await expect(
      service.cancelBeforeDeparture('tx-1', 'sender-1', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects traveler-side cancellation when payout flow has already started', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      amount: 185,
      escrowAmount: 185,
      currency: 'EUR',
      payout: {
        id: 'po-1',
        status: 'REQUESTED',
      },
    });

    await expect(
      service.cancelBeforeDepartureByTraveler('tx-1', 'traveler-1', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses ledger escrow balance fallback for sender-side cancellation when escrowAmount is 0', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      amount: 185,
      escrowAmount: 0,
      currency: 'EUR',
      payout: null,
    });

    ledger.getEscrowBalance.mockResolvedValue(185);

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        transaction: {
          update: jest.fn().mockResolvedValue({
            id: 'tx-1',
            status: TransactionStatus.CANCELLED,
          }),
        },
        refund: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'rf-1',
            transactionId: 'tx-1',
            provider: RefundProvider.MANUAL,
            status: RefundStatus.REQUESTED,
            amount: 185,
            currency: 'EUR',
          }),
          update: jest.fn(),
        },
      }),
    );

    const result = await service.cancelBeforeDeparture(
      'tx-1',
      'sender-1',
      Role.USER,
    );

    expect(ledger.getEscrowBalance).toHaveBeenCalledWith('tx-1');
    expect(result.refundAmount).toBe(185);
  });

  it('uses ledger escrow balance fallback for traveler-side cancellation when escrowAmount is 0', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      amount: 185,
      escrowAmount: 0,
      currency: 'EUR',
      payout: null,
    });

    ledger.getEscrowBalance.mockResolvedValue(185);

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        transaction: {
          update: jest.fn().mockResolvedValue({
            id: 'tx-1',
            status: TransactionStatus.CANCELLED,
          }),
        },
        refund: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'rf-2',
            transactionId: 'tx-1',
            provider: RefundProvider.MANUAL,
            status: RefundStatus.REQUESTED,
            amount: 185,
            currency: 'EUR',
          }),
          update: jest.fn(),
        },
      }),
    );

    const result = await service.cancelBeforeDepartureByTraveler(
      'tx-1',
      'traveler-1',
      Role.USER,
    );

    expect(ledger.getEscrowBalance).toHaveBeenCalledWith('tx-1');
    expect(result.refundAmount).toBe(185);
  });

  it('returns existing refund for sender-side cancellation when a refund request is already active', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      amount: 185,
      escrowAmount: 185,
      currency: 'EUR',
      payout: null,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        transaction: {
          update: jest.fn().mockResolvedValue({
            id: 'tx-1',
            status: TransactionStatus.CANCELLED,
          }),
        },
        refund: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'rf-1',
            transactionId: 'tx-1',
            provider: RefundProvider.MANUAL,
            status: RefundStatus.REQUESTED,
            amount: 185,
            currency: 'EUR',
          }),
          create: jest.fn(),
          update: jest.fn(),
        },
      }),
    );

    const result = await service.cancelBeforeDeparture(
      'tx-1',
      'sender-1',
      Role.USER,
    );

    expect(result.refund.id).toBe('rf-1');
    expect(result.refund.status).toBe(RefundStatus.REQUESTED);
  });

  it('returns existing refund for traveler-side cancellation when a refund request is already active', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      amount: 185,
      escrowAmount: 185,
      currency: 'EUR',
      payout: null,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        transaction: {
          update: jest.fn().mockResolvedValue({
            id: 'tx-1',
            status: TransactionStatus.CANCELLED,
          }),
        },
        refund: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'rf-2',
            transactionId: 'tx-1',
            provider: RefundProvider.MANUAL,
            status: RefundStatus.REQUESTED,
            amount: 185,
            currency: 'EUR',
          }),
          create: jest.fn(),
          update: jest.fn(),
        },
      }),
    );

    const result = await service.cancelBeforeDepartureByTraveler(
      'tx-1',
      'traveler-1',
      Role.USER,
    );

    expect(result.refund.id).toBe('rf-2');
    expect(result.refund.status).toBe(RefundStatus.REQUESTED);
  });

  it('throws NotFoundException for sender-side cancellation when transaction does not exist', async () => {
    prisma.transaction.findFirst.mockResolvedValue(null);

    await expect(
      service.cancelBeforeDeparture('missing-tx', 'sender-1', Role.USER),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException for traveler-side cancellation when transaction does not exist', async () => {
    prisma.transaction.findFirst.mockResolvedValue(null);

    await expect(
      service.cancelBeforeDepartureByTraveler(
        'missing-tx',
        'traveler-1',
        Role.USER,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TransactionService - post-departure blocking', () => {
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

  const departedAt = new Date('2026-03-10T10:00:00.000Z');
  const futureDepartAt = new Date('2099-04-10T10:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.refund.findMany.mockResolvedValue([]);
    prisma.dispute.findMany.mockResolvedValue([]);
    prisma.dispute.findFirst.mockReset();
    prisma.dispute.create.mockReset();

    service = new TransactionService(
      prisma as any,
      ledger as any,
      abandonment as any,
      payoutService as any,
    );
  });

  it('allows sender to block after departure, moves transaction to DISPUTED and creates OPEN dispute with structured openingSource', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      trip: { departAt: departedAt },
    });

    prisma.transaction.update.mockResolvedValue({
      id: 'tx-1',
      status: TransactionStatus.DISPUTED,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        dispute: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'dp-1',
            transactionId: 'tx-1',
            openedById: 'sender-1',
            reason:
              'Post-departure blocking requested from sender side. Manual review required.',
            reasonCode: DisputeReasonCode.OTHER,
            openingSource:
              DisputeOpeningSource.POST_DEPARTURE_BLOCK_SENDER,
            status: DisputeStatus.OPEN,
          }),
        },
      }),
    );

    const result = await service.blockAfterDeparture(
      'tx-1',
      'sender-1',
      Role.USER,
    );

    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      data: { status: TransactionStatus.DISPUTED },
    });
    expect(result.transaction.status).toBe(TransactionStatus.DISPUTED);
    expect(result.dispute.status).toBe(DisputeStatus.OPEN);
    expect(result.dispute.reason).toBe(
      'Post-departure blocking requested from sender side. Manual review required.',
    );
    expect(result.dispute.openingSource).toBe(
      DisputeOpeningSource.POST_DEPARTURE_BLOCK_SENDER,
    );
    expect(result.automaticRefundTriggered).toBe(false);
    expect(result.automaticPayoutTriggered).toBe(false);
  });

  it('allows traveler to block after departure, moves transaction to DISPUTED and creates OPEN dispute with structured openingSource', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-2',
      senderId: 'sender-2',
      travelerId: 'traveler-2',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      trip: { departAt: departedAt },
    });

    prisma.transaction.update.mockResolvedValue({
      id: 'tx-2',
      status: TransactionStatus.DISPUTED,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        dispute: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'dp-2',
            transactionId: 'tx-2',
            openedById: 'traveler-2',
            reason:
              'Post-departure blocking requested from traveler side. Manual review required.',
            reasonCode: DisputeReasonCode.OTHER,
            openingSource:
              DisputeOpeningSource.POST_DEPARTURE_BLOCK_TRAVELER,
            status: DisputeStatus.OPEN,
          }),
        },
      }),
    );

    const result = await service.blockAfterDepartureByTraveler(
      'tx-2',
      'traveler-2',
      Role.USER,
    );

    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-2' },
      data: { status: TransactionStatus.DISPUTED },
    });
    expect(result.transaction.status).toBe(TransactionStatus.DISPUTED);
    expect(result.dispute.status).toBe(DisputeStatus.OPEN);
    expect(result.dispute.reason).toBe(
      'Post-departure blocking requested from traveler side. Manual review required.',
    );
    expect(result.dispute.openingSource).toBe(
      DisputeOpeningSource.POST_DEPARTURE_BLOCK_TRAVELER,
    );
    expect(result.automaticRefundTriggered).toBe(false);
    expect(result.automaticPayoutTriggered).toBe(false);
  });

  it('allows ADMIN to trigger sender-side post-departure blocking', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-3',
      senderId: 'sender-3',
      travelerId: 'traveler-3',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      trip: { departAt: departedAt },
    });

    prisma.transaction.update.mockResolvedValue({
      id: 'tx-3',
      status: TransactionStatus.DISPUTED,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        dispute: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'dp-3',
            transactionId: 'tx-3',
            openedById: 'admin-1',
            reason:
              'Post-departure blocking requested from sender side. Manual review required.',
            reasonCode: DisputeReasonCode.OTHER,
            openingSource:
              DisputeOpeningSource.POST_DEPARTURE_BLOCK_SENDER,
            status: DisputeStatus.OPEN,
          }),
        },
      }),
    );

    const result = await service.blockAfterDeparture(
      'tx-3',
      'admin-1',
      Role.ADMIN,
    );

    expect(result.transaction.status).toBe(TransactionStatus.DISPUTED);
    expect(result.dispute.status).toBe(DisputeStatus.OPEN);
    expect(result.dispute.openingSource).toBe(
      DisputeOpeningSource.POST_DEPARTURE_BLOCK_SENDER,
    );
  });

  it('allows ADMIN to trigger traveler-side post-departure blocking', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-4',
      senderId: 'sender-4',
      travelerId: 'traveler-4',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      trip: { departAt: departedAt },
    });

    prisma.transaction.update.mockResolvedValue({
      id: 'tx-4',
      status: TransactionStatus.DISPUTED,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        dispute: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'dp-4',
            transactionId: 'tx-4',
            openedById: 'admin-1',
            reason:
              'Post-departure blocking requested from traveler side. Manual review required.',
            reasonCode: DisputeReasonCode.OTHER,
            openingSource:
              DisputeOpeningSource.POST_DEPARTURE_BLOCK_TRAVELER,
            status: DisputeStatus.OPEN,
          }),
        },
      }),
    );

    const result = await service.blockAfterDepartureByTraveler(
      'tx-4',
      'admin-1',
      Role.ADMIN,
    );

    expect(result.transaction.status).toBe(TransactionStatus.DISPUTED);
    expect(result.dispute.status).toBe(DisputeStatus.OPEN);
    expect(result.dispute.openingSource).toBe(
      DisputeOpeningSource.POST_DEPARTURE_BLOCK_TRAVELER,
    );
  });

  it('rejects outsider sender-side post-departure blocking', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-5',
      senderId: 'sender-5',
      travelerId: 'traveler-5',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      trip: { departAt: departedAt },
    });

    await expect(
      service.blockAfterDeparture('tx-5', 'outsider-1', Role.USER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects outsider traveler-side post-departure blocking', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-6',
      senderId: 'sender-6',
      travelerId: 'traveler-6',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      trip: { departAt: departedAt },
    });

    await expect(
      service.blockAfterDepartureByTraveler('tx-6', 'outsider-1', Role.USER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects sender-side post-departure blocking when transaction is not paid', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-7',
      senderId: 'sender-7',
      travelerId: 'traveler-7',
      paymentStatus: PaymentStatus.PENDING,
      status: TransactionStatus.CREATED,
      trip: { departAt: departedAt },
    });

    await expect(
      service.blockAfterDeparture('tx-7', 'sender-7', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects traveler-side post-departure blocking when transaction is not paid', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-8',
      senderId: 'sender-8',
      travelerId: 'traveler-8',
      paymentStatus: PaymentStatus.PENDING,
      status: TransactionStatus.CREATED,
      trip: { departAt: departedAt },
    });

    await expect(
      service.blockAfterDepartureByTraveler('tx-8', 'traveler-8', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects sender-side post-departure blocking before departure time', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-9',
      senderId: 'sender-9',
      travelerId: 'traveler-9',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      trip: { departAt: futureDepartAt },
    });

    await expect(
      service.blockAfterDeparture('tx-9', 'sender-9', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects traveler-side post-departure blocking before departure time', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-10',
      senderId: 'sender-10',
      travelerId: 'traveler-10',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      trip: { departAt: futureDepartAt },
    });

    await expect(
      service.blockAfterDepartureByTraveler('tx-10', 'traveler-10', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects sender-side post-departure blocking when trip departure date is missing', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-11',
      senderId: 'sender-11',
      travelerId: 'traveler-11',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      trip: null,
    });

    await expect(
      service.blockAfterDeparture('tx-11', 'sender-11', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects traveler-side post-departure blocking when trip departure date is missing', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-12',
      senderId: 'sender-12',
      travelerId: 'traveler-12',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.PAID,
      trip: null,
    });

    await expect(
      service.blockAfterDepartureByTraveler('tx-12', 'traveler-12', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns already blocked response for sender-side post-departure blocking when status is already DISPUTED and reuses existing OPEN dispute', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-13',
      senderId: 'sender-13',
      travelerId: 'traveler-13',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.DISPUTED,
      trip: { departAt: departedAt },
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        dispute: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'dp-13',
            transactionId: 'tx-13',
            openedById: 'sender-13',
            reason:
              'Post-departure blocking requested from sender side. Manual review required.',
            reasonCode: DisputeReasonCode.OTHER,
            openingSource:
              DisputeOpeningSource.POST_DEPARTURE_BLOCK_SENDER,
            status: DisputeStatus.OPEN,
          }),
          create: jest.fn(),
        },
      }),
    );

    const result = await service.blockAfterDeparture(
      'tx-13',
      'sender-13',
      Role.USER,
    );

    expect(prisma.transaction.update).not.toHaveBeenCalled();
    expect(result.transaction.status).toBe(TransactionStatus.DISPUTED);
    expect(result.dispute.id).toBe('dp-13');
    expect(result.dispute.openingSource).toBe(
      DisputeOpeningSource.POST_DEPARTURE_BLOCK_SENDER,
    );
    expect(result.automaticRefundTriggered).toBe(false);
    expect(result.automaticPayoutTriggered).toBe(false);
  });

  it('returns already blocked response for traveler-side post-departure blocking when status is already DISPUTED and reuses existing OPEN dispute', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-14',
      senderId: 'sender-14',
      travelerId: 'traveler-14',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.DISPUTED,
      trip: { departAt: departedAt },
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        dispute: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'dp-14',
            transactionId: 'tx-14',
            openedById: 'traveler-14',
            reason:
              'Post-departure blocking requested from traveler side. Manual review required.',
            reasonCode: DisputeReasonCode.OTHER,
            openingSource:
              DisputeOpeningSource.POST_DEPARTURE_BLOCK_TRAVELER,
            status: DisputeStatus.OPEN,
          }),
          create: jest.fn(),
        },
      }),
    );

    const result = await service.blockAfterDepartureByTraveler(
      'tx-14',
      'traveler-14',
      Role.USER,
    );

    expect(prisma.transaction.update).not.toHaveBeenCalled();
    expect(result.transaction.status).toBe(TransactionStatus.DISPUTED);
    expect(result.dispute.id).toBe('dp-14');
    expect(result.dispute.openingSource).toBe(
      DisputeOpeningSource.POST_DEPARTURE_BLOCK_TRAVELER,
    );
    expect(result.automaticRefundTriggered).toBe(false);
    expect(result.automaticPayoutTriggered).toBe(false);
  });

  it('creates a missing OPEN dispute when sender-side transaction is already DISPUTED without open dispute', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-19',
      senderId: 'sender-19',
      travelerId: 'traveler-19',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.DISPUTED,
      trip: { departAt: departedAt },
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        dispute: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'dp-19',
            transactionId: 'tx-19',
            openedById: 'sender-19',
            reason:
              'Post-departure blocking requested from sender side. Manual review required.',
            reasonCode: DisputeReasonCode.OTHER,
            openingSource:
              DisputeOpeningSource.POST_DEPARTURE_BLOCK_SENDER,
            status: DisputeStatus.OPEN,
          }),
        },
      }),
    );

    const result = await service.blockAfterDeparture(
      'tx-19',
      'sender-19',
      Role.USER,
    );

    expect(result.transaction.status).toBe(TransactionStatus.DISPUTED);
    expect(result.dispute.id).toBe('dp-19');
    expect(result.dispute.openingSource).toBe(
      DisputeOpeningSource.POST_DEPARTURE_BLOCK_SENDER,
    );
    expect(result.automaticRefundTriggered).toBe(false);
    expect(result.automaticPayoutTriggered).toBe(false);
  });

  it('creates a missing OPEN dispute when traveler-side transaction is already DISPUTED without open dispute', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-20',
      senderId: 'sender-20',
      travelerId: 'traveler-20',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.DISPUTED,
      trip: { departAt: departedAt },
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        dispute: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'dp-20',
            transactionId: 'tx-20',
            openedById: 'traveler-20',
            reason:
              'Post-departure blocking requested from traveler side. Manual review required.',
            reasonCode: DisputeReasonCode.OTHER,
            openingSource:
              DisputeOpeningSource.POST_DEPARTURE_BLOCK_TRAVELER,
            status: DisputeStatus.OPEN,
          }),
        },
      }),
    );

    const result = await service.blockAfterDepartureByTraveler(
      'tx-20',
      'traveler-20',
      Role.USER,
    );

    expect(result.transaction.status).toBe(TransactionStatus.DISPUTED);
    expect(result.dispute.id).toBe('dp-20');
    expect(result.dispute.openingSource).toBe(
      DisputeOpeningSource.POST_DEPARTURE_BLOCK_TRAVELER,
    );
    expect(result.automaticRefundTriggered).toBe(false);
    expect(result.automaticPayoutTriggered).toBe(false);
  });

  it('rejects sender-side post-departure blocking when transaction is already CANCELLED', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-15',
      senderId: 'sender-15',
      travelerId: 'traveler-15',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.CANCELLED,
      trip: { departAt: departedAt },
    });

    await expect(
      service.blockAfterDeparture('tx-15', 'sender-15', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects traveler-side post-departure blocking when transaction is already CANCELLED', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-16',
      senderId: 'sender-16',
      travelerId: 'traveler-16',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.CANCELLED,
      trip: { departAt: departedAt },
    });

    await expect(
      service.blockAfterDepartureByTraveler('tx-16', 'traveler-16', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects sender-side post-departure blocking when transaction is already DELIVERED', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-17',
      senderId: 'sender-17',
      travelerId: 'traveler-17',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.DELIVERED,
      trip: { departAt: departedAt },
    });

    await expect(
      service.blockAfterDeparture('tx-17', 'sender-17', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects traveler-side post-departure blocking when transaction is already DELIVERED', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-18',
      senderId: 'sender-18',
      travelerId: 'traveler-18',
      paymentStatus: PaymentStatus.SUCCESS,
      status: TransactionStatus.DELIVERED,
      trip: { departAt: departedAt },
    });

    await expect(
      service.blockAfterDepartureByTraveler('tx-18', 'traveler-18', Role.USER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException for sender-side post-departure blocking when transaction does not exist', async () => {
    prisma.transaction.findFirst.mockResolvedValue(null);

    await expect(
      service.blockAfterDeparture('missing-tx', 'sender-1', Role.USER),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException for traveler-side post-departure blocking when transaction does not exist', async () => {
    prisma.transaction.findFirst.mockResolvedValue(null);

    await expect(
      service.blockAfterDepartureByTraveler(
        'missing-tx',
        'traveler-1',
        Role.USER,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TransactionService - pricingDetails on read endpoints', () => {
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

  it('adds pricingDetails to findAll results', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        amount: 185,
        currency: 'EUR',
        senderId: 'sender-1',
        travelerId: 'traveler-1',
        tripId: 'trip-1',
        packageId: 'package-1',
        corridorId: 'corridor-1',
        status: TransactionStatus.CREATED,
        paymentStatus: PaymentStatus.PENDING,
        sender: {
          id: 'sender-1',
          email: 'sender@test.com',
          role: Role.USER,
          kycStatus: 'VERIFIED',
        },
        traveler: {
          id: 'traveler-1',
          email: 'traveler@test.com',
          role: Role.USER,
          kycStatus: 'VERIFIED',
        },
        trip: {
          id: 'trip-1',
          status: 'ACTIVE',
          flightTicketStatus: 'VERIFIED',
          departAt: new Date('2026-04-10T10:00:00.000Z'),
          corridorId: 'corridor-1',
          carrierId: 'traveler-1',
        },
        package: {
          id: 'package-1',
          status: 'RESERVED',
          weightKg: 23,
          description: 'Package 23kg',
          corridorId: 'corridor-1',
          senderId: 'sender-1',
        },
        corridor: {
          id: 'corridor-1',
          code: 'FR_CM',
          name: 'FR_CM',
          status: 'ACTIVE',
        },
        payout: null,
      },
    ]);

    prisma.corridorPricingPaymentConfig.findMany.mockResolvedValue([
      {
        corridorCode: 'FR_CM',
        settlementCurrency: 'EUR',
        senderPricePerKg: 11.5,
        senderPriceBundle23kg: 185,
        senderPriceBundle32kg: 210,
      },
    ]);

    const result = await service.findAll('sender-1', Role.USER);

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ senderId: 'sender-1' }, { travelerId: 'sender-1' }],
        },
      }),
    );

    expect(prisma.refund.findMany).toHaveBeenCalledWith({
      where: {
        transactionId: { in: ['tx-1'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(prisma.dispute.findMany).toHaveBeenCalledWith({
      where: {
        transactionId: { in: ['tx-1'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        resolution: true,
      },
    });

    expect(result[0].pricingDetails).toEqual({
      corridorCode: 'FR_CM',
      weightKg: 23,
      pricingModelApplied: 'BUNDLE_23KG',
      computedAmount: 185,
      settlementCurrency: 'EUR',
      senderPricePerKg: 11.5,
      senderPriceBundle23kg: 185,
      senderPriceBundle32kg: 210,
    });
    expect(result[0].refund).toBeNull();
    expect(result[0].dispute).toBeNull();
    expect(result[0].adminOperationalSnapshot).toEqual({
      hasOpenDispute: false,
      hasRequestedPayout: false,
      hasRequestedRefund: false,
      requiresAdminAttention: false,
    });
  });

  it('lists all transactions for ADMIN', async () => {
    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.corridorPricingPaymentConfig.findMany.mockResolvedValue([]);

    await service.findAll('admin-1', Role.ADMIN);

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
      }),
    );
  });

  it('adds pricingDetails to findOne result', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      amount: 115,
      currency: 'EUR',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      tripId: 'trip-1',
      packageId: 'package-1',
      corridorId: 'corridor-1',
      status: TransactionStatus.CREATED,
      paymentStatus: PaymentStatus.PENDING,
      sender: {
        id: 'sender-1',
        email: 'sender@test.com',
        role: Role.USER,
        kycStatus: 'VERIFIED',
      },
      traveler: {
        id: 'traveler-1',
        email: 'traveler@test.com',
        role: Role.USER,
        kycStatus: 'VERIFIED',
      },
      trip: {
        id: 'trip-1',
        status: 'ACTIVE',
        flightTicketStatus: 'VERIFIED',
        departAt: new Date('2026-04-10T10:00:00.000Z'),
        corridorId: 'corridor-1',
        carrierId: 'traveler-1',
      },
      package: {
        id: 'package-1',
        status: 'RESERVED',
        weightKg: 10,
        description: 'Package 10kg',
        corridorId: 'corridor-1',
        senderId: 'sender-1',
      },
      corridor: {
        id: 'corridor-1',
        code: 'FR_CI',
        name: 'FR_CI',
        status: 'ACTIVE',
      },
      payout: null,
    });

    prisma.corridorPricingPaymentConfig.findMany.mockResolvedValue([
      {
        corridorCode: 'FR_CI',
        settlementCurrency: 'EUR',
        senderPricePerKg: 11.5,
        senderPriceBundle23kg: 160,
        senderPriceBundle32kg: 200,
      },
    ]);

    const result = await service.findOne('tx-1', 'sender-1', Role.USER);

    expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'tx-1',
          OR: [{ senderId: 'sender-1' }, { travelerId: 'sender-1' }],
        },
      }),
    );

    expect(result.pricingDetails).toEqual({
      corridorCode: 'FR_CI',
      weightKg: 10,
      pricingModelApplied: 'PER_KG',
      computedAmount: 115,
      settlementCurrency: 'EUR',
      senderPricePerKg: 11.5,
      senderPriceBundle23kg: 160,
      senderPriceBundle32kg: 200,
    });
    expect(result.refund).toBeNull();
    expect(result.dispute).toBeNull();
    expect(result.adminOperationalSnapshot).toEqual({
      hasOpenDispute: false,
      hasRequestedPayout: false,
      hasRequestedRefund: false,
      requiresAdminAttention: false,
    });
  });

  it('allows ADMIN to read any transaction', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      amount: 115,
      currency: 'EUR',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      tripId: 'trip-1',
      packageId: 'package-1',
      corridorId: 'corridor-1',
      status: TransactionStatus.CREATED,
      paymentStatus: PaymentStatus.PENDING,
      sender: {
        id: 'sender-1',
        email: 'sender@test.com',
        role: Role.USER,
        kycStatus: 'VERIFIED',
      },
      traveler: {
        id: 'traveler-1',
        email: 'traveler@test.com',
        role: Role.USER,
        kycStatus: 'VERIFIED',
      },
      trip: {
        id: 'trip-1',
        status: 'ACTIVE',
        flightTicketStatus: 'VERIFIED',
        departAt: new Date('2026-04-10T10:00:00.000Z'),
        corridorId: 'corridor-1',
        carrierId: 'traveler-1',
      },
      package: {
        id: 'package-1',
        status: 'RESERVED',
        weightKg: 10,
        description: 'Package 10kg',
        corridorId: 'corridor-1',
        senderId: 'sender-1',
      },
      corridor: {
        id: 'corridor-1',
        code: 'FR_CI',
        name: 'FR_CI',
        status: 'ACTIVE',
      },
      payout: null,
    });

    prisma.corridorPricingPaymentConfig.findMany.mockResolvedValue([
      {
        corridorCode: 'FR_CI',
        settlementCurrency: 'EUR',
        senderPricePerKg: 11.5,
        senderPriceBundle23kg: 160,
        senderPriceBundle32kg: 200,
      },
    ]);

    await service.findOne('tx-1', 'admin-1', Role.ADMIN);

    expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx-1' },
      }),
    );
  });

  it('throws NotFoundException when transaction is not visible to the actor', async () => {
    prisma.transaction.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('tx-1', 'outsider-1', Role.USER),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns pricingDetails as null when pricing config is missing on read', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      amount: 115,
      currency: 'EUR',
      senderId: 'sender-1',
      travelerId: 'traveler-1',
      tripId: 'trip-1',
      packageId: 'package-1',
      corridorId: 'corridor-1',
      status: TransactionStatus.CREATED,
      paymentStatus: PaymentStatus.PENDING,
      sender: {
        id: 'sender-1',
        email: 'sender@test.com',
        role: Role.USER,
        kycStatus: 'VERIFIED',
      },
      traveler: {
        id: 'traveler-1',
        email: 'traveler@test.com',
        role: Role.USER,
        kycStatus: 'VERIFIED',
      },
      trip: {
        id: 'trip-1',
        status: 'ACTIVE',
        flightTicketStatus: 'VERIFIED',
        departAt: new Date('2026-04-10T10:00:00.000Z'),
        corridorId: 'corridor-1',
        carrierId: 'traveler-1',
      },
      package: {
        id: 'package-1',
        status: 'RESERVED',
        weightKg: 10,
        description: 'Package 10kg',
        corridorId: 'corridor-1',
        senderId: 'sender-1',
      },
      corridor: {
        id: 'corridor-1',
        code: 'UNKNOWN_CODE',
        name: 'UNKNOWN_CODE',
        status: 'ACTIVE',
      },
      payout: null,
    });

    prisma.corridorPricingPaymentConfig.findMany.mockResolvedValue([]);

    const result = await service.findOne('tx-1', 'sender-1', Role.USER);

    expect(result.pricingDetails).toBeNull();
    expect(result.refund).toBeNull();
    expect(result.dispute).toBeNull();
    expect(result.adminOperationalSnapshot).toEqual({
      hasOpenDispute: false,
      hasRequestedPayout: false,
      hasRequestedRefund: false,
      requiresAdminAttention: false,
    });
  });
});

describe('TransactionService - ledger read permissions', () => {
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

  it('allows USER to read ledger for visible transaction', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      currency: 'EUR',
    });

    ledger.listByTransaction.mockResolvedValue([
      {
        type: 'ESCROW_CREDIT',
        amount: 100,
        currency: 'EUR',
        createdAt: new Date('2026-04-10T10:00:00.000Z'),
        note: 'Payment confirmed',
        idempotencyKey: 'payment_success:tx-1',
        source: 'PAYMENT',
        referenceType: 'PAYMENT',
        referenceId: 'payment_success:tx-1',
        actorUserId: null,
      },
    ]);

    const result = await service.getLedger('tx-1', 'sender-1', Role.USER);

    expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'tx-1',
        OR: [{ senderId: 'sender-1' }, { travelerId: 'sender-1' }],
      },
      select: { id: true, currency: true },
    });

    expect(result.transactionId).toBe('tx-1');
    expect(result.transactionCurrency).toBe('EUR');
    expect(result.entries).toHaveLength(1);
  });

  it('allows ADMIN to read any ledger', async () => {
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      currency: 'EUR',
    });

    ledger.listByTransaction.mockResolvedValue([]);

    await service.getLedger('tx-1', 'admin-1', Role.ADMIN);

    expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      select: { id: true, currency: true },
    });
  });

  it('throws NotFoundException when ledger transaction is not visible', async () => {
    prisma.transaction.findFirst.mockResolvedValue(null);

    await expect(
      service.getLedger('tx-1', 'outsider-1', Role.USER),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(ledger.listByTransaction).not.toHaveBeenCalled();
  });
});