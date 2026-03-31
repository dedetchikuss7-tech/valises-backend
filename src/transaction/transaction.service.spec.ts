import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Role, TransactionStatus } from '@prisma/client';
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

  it('allows a valid CREATED -> CANCELLED transition', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      status: TransactionStatus.CREATED,
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

  it('rejects an invalid CREATED -> DELIVERED transition', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      status: TransactionStatus.CREATED,
    });

    await expect(
      service.updateStatus('tx-1', TransactionStatus.DELIVERED),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a same-status transition', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      status: TransactionStatus.CREATED,
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
  });
});