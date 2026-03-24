import { BadRequestException } from '@nestjs/common';
import { PaymentStatus, TransactionStatus } from '@prisma/client';
import { TransactionService } from './transaction.service';

describe('TransactionService - automatic pricing on create', () => {
  let service: TransactionService;

  const prisma = {
    user: {
      findUnique: jest.fn(),
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

    expect(dbTx.transaction.create).toHaveBeenCalledWith({
      data: {
        senderId,
        travelerId,
        tripId,
        packageId,
        corridorId,
        amount: 185,
        commission: 0,
        escrowAmount: 0,
        currency: 'EUR',
        status: TransactionStatus.CREATED,
        paymentStatus: PaymentStatus.PENDING,
      },
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
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback(dbTx),
    );

    const result = await service.create(senderId, dto);

    expect(result.transaction.amount).toBe(210);
    expect(result.transaction.currency).toBe('EUR');
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
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback(dbTx),
    );

    const result = await service.create(senderId, dto);

    expect(result.transaction.amount).toBe(115);
    expect(result.transaction.currency).toBe('EUR');
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

    expect(dbTx.package.update).not.toHaveBeenCalled();
    expect(dbTx.transaction.create).not.toHaveBeenCalled();
  });

  it('throws PRICING_CONFIG_INACTIVE when corridor pricing config is inactive', async () => {
    const dbTx = buildDbTx({
      packageWeightKg: 10,
      pricingIsActive: false,
      pricingIsVisible: true,
      pricingIsBookable: true,
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

    expect(dbTx.package.update).not.toHaveBeenCalled();
    expect(dbTx.transaction.create).not.toHaveBeenCalled();
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

    expect(dbTx.package.update).not.toHaveBeenCalled();
    expect(dbTx.transaction.create).not.toHaveBeenCalled();
  });

  it('throws when package weight is invalid', async () => {
    const dbTx = buildDbTx({
      packageWeightKg: 0,
      settlementCurrency: 'EUR',
      senderPricePerKg: 11.5,
      pricingIsVisible: true,
      pricingIsBookable: true,
    });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback(dbTx),
    );

    await expect(service.create(senderId, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});