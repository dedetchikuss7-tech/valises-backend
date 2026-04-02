import { createHash, randomBytes, randomInt } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AbandonmentKind,
  DisputeReasonCode,
  DisputeStatus,
  KycStatus,
  LedgerEntryType,
  LedgerReferenceType,
  LedgerSource,
  PaymentStatus,
  RefundProvider,
  RefundStatus,
  Role,
  Transaction,
  TransactionStatus,
} from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';
import { AbandonmentService } from '../abandonment/abandonment.service';
import { PayoutService } from '../payout/payout.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionStateMachine } from './transaction-state-machine';

type PricingModelApplied = 'PER_KG' | 'BUNDLE_23KG' | 'BUNDLE_32KG';

type CreateTransactionPricingDetails = {
  corridorCode: string;
  weightKg: number;
  pricingModelApplied: PricingModelApplied;
  computedAmount: number;
  settlementCurrency: string;
  senderPricePerKg: number | null;
  senderPriceBundle23kg: number | null;
  senderPriceBundle32kg: number | null;
};

type CreateTransactionResponse = {
  transaction: Transaction;
  pricingDetails: CreateTransactionPricingDetails;
};

type MarkPaymentSuccessResponse = {
  transaction: Transaction;
  deliveryCode: {
    code: string;
    generatedAt: Date;
    expiresAt: Date;
  };
};

type TransactionWithRelations = {
  id: string;
  senderId: string;
  travelerId: string;
  tripId: string;
  packageId: string;
  corridorId: string;
  amount: any;
  currency: string;
  status: TransactionStatus;
  paymentStatus: PaymentStatus;
  deliveryCodeHash?: string | null;
  deliveryCodeSalt?: string | null;
  deliveryCodeGeneratedAt?: Date | null;
  deliveryCodeExpiresAt?: Date | null;
  deliveryCodeConsumedAt?: Date | null;
  deliveryConfirmedAt?: Date | null;
  sender: {
    id: string;
    email: string;
    role: Role;
    kycStatus: KycStatus;
  };
  traveler: {
    id: string;
    email: string;
    role: Role;
    kycStatus: KycStatus;
  };
  trip: {
    id: string;
    status: string;
    flightTicketStatus: string;
    departAt: Date;
    corridorId: string;
    carrierId: string;
  };
  package: {
    id: string;
    status: string;
    weightKg: any;
    description: string;
    corridorId: string;
    senderId: string;
  };
  corridor: {
    id: string;
    code: string;
    name: string;
    status: string;
  } | null;
  payout: any;
};

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly abandonment: AbandonmentService,
    private readonly payoutService: PayoutService,
  ) {}

  private static readonly MAX_PER_TX_VERIFIED_XAF = 2_000_000;
  private static readonly DELIVERY_CODE_TTL_HOURS = 24 * 7;

  private resolvePricingModel(weightKg: number): PricingModelApplied {
    if (weightKg === 23) {
      return 'BUNDLE_23KG';
    }
    if (weightKg === 32) {
      return 'BUNDLE_32KG';
    }
    return 'PER_KG';
  }

  private buildTransactionInclude() {
    return {
      sender: {
        select: { id: true, email: true, role: true, kycStatus: true },
      },
      traveler: {
        select: { id: true, email: true, role: true, kycStatus: true },
      },
      trip: {
        select: {
          id: true,
          status: true,
          flightTicketStatus: true,
          departAt: true,
          corridorId: true,
          carrierId: true,
        },
      },
      package: {
        select: {
          id: true,
          status: true,
          weightKg: true,
          description: true,
          corridorId: true,
          senderId: true,
        },
      },
      corridor: {
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
        },
      },
      payout: true,
    };
  }

  private computeAutomaticAmount(input: {
    weightKg: number;
    senderPricePerKg: number | null;
    senderPriceBundle23kg: number | null;
    senderPriceBundle32kg: number | null;
  }): {
    pricingModel: PricingModelApplied;
    amount: number;
  } {
    const {
      weightKg,
      senderPricePerKg,
      senderPriceBundle23kg,
      senderPriceBundle32kg,
    } = input;

    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      throw new BadRequestException('Package weightKg must be a positive number');
    }

    const pricingModel = this.resolvePricingModel(weightKg);

    if (pricingModel === 'BUNDLE_23KG') {
      if (
        senderPriceBundle23kg === null ||
        senderPriceBundle23kg === undefined ||
        !Number.isFinite(senderPriceBundle23kg) ||
        senderPriceBundle23kg <= 0
      ) {
        throw new BadRequestException({
          code: 'PRICING_CONFIG_MISSING',
          message:
            'Missing senderPriceBundle23kg for corridor pricing configuration.',
          pricingModel,
        });
      }

      return {
        pricingModel,
        amount: Math.round(senderPriceBundle23kg),
      };
    }

    if (pricingModel === 'BUNDLE_32KG') {
      if (
        senderPriceBundle32kg === null ||
        senderPriceBundle32kg === undefined ||
        !Number.isFinite(senderPriceBundle32kg) ||
        senderPriceBundle32kg <= 0
      ) {
        throw new BadRequestException({
          code: 'PRICING_CONFIG_MISSING',
          message:
            'Missing senderPriceBundle32kg for corridor pricing configuration.',
          pricingModel,
        });
      }

      return {
        pricingModel,
        amount: Math.round(senderPriceBundle32kg),
      };
    }

    if (
      senderPricePerKg === null ||
      senderPricePerKg === undefined ||
      !Number.isFinite(senderPricePerKg) ||
      senderPricePerKg <= 0
    ) {
      throw new BadRequestException({
        code: 'PRICING_CONFIG_MISSING',
        message: 'Missing senderPricePerKg for corridor pricing configuration.',
        pricingModel,
      });
    }

    return {
      pricingModel,
      amount: Math.round(weightKg * senderPricePerKg),
    };
  }

  private buildPricingDetailsFromData(input: {
    corridorCode: string;
    weightKg: number;
    transactionAmount: number;
    transactionCurrency: string;
    senderPricePerKg: number | null;
    senderPriceBundle23kg: number | null;
    senderPriceBundle32kg: number | null;
  }): CreateTransactionPricingDetails {
    const {
      corridorCode,
      weightKg,
      transactionAmount,
      transactionCurrency,
      senderPricePerKg,
      senderPriceBundle23kg,
      senderPriceBundle32kg,
    } = input;

    return {
      corridorCode,
      weightKg,
      pricingModelApplied: this.resolvePricingModel(weightKg),
      computedAmount: transactionAmount,
      settlementCurrency: transactionCurrency,
      senderPricePerKg,
      senderPriceBundle23kg,
      senderPriceBundle32kg,
    };
  }

  private maskEmail(email: string): string {
    const normalized = String(email ?? '').trim().toLowerCase();
    const [localPart, domainPart] = normalized.split('@');

    if (!localPart || !domainPart) {
      return '***';
    }

    const domainParts = domainPart.split('.');
    const domainName = domainParts[0] ?? '';
    const domainSuffix = domainParts.slice(1).join('.');

    const maskedLocal = localPart.length <= 1 ? '*' : `${localPart[0]}***`;
    const maskedDomainName =
      domainName.length <= 1 ? '*' : `${domainName[0]}***`;

    return domainSuffix
      ? `${maskedLocal}@${maskedDomainName}.${domainSuffix}`
      : `${maskedLocal}@${maskedDomainName}`;
  }

  private applyPrePaymentVisibility(
    transaction: any,
    actorUserId: string,
    actorRole: Role,
  ) {
    const shouldMaskCounterparty =
      actorRole !== Role.ADMIN &&
      transaction.paymentStatus !== PaymentStatus.SUCCESS;

    if (!shouldMaskCounterparty) {
      return {
        ...transaction,
        contactDetailsMasked: false,
      };
    }

    const maskedSender =
      transaction.sender?.id === actorUserId
        ? transaction.sender
        : {
            ...transaction.sender,
            email: this.maskEmail(transaction.sender?.email ?? ''),
          };

    const maskedTraveler =
      transaction.traveler?.id === actorUserId
        ? transaction.traveler
        : {
            ...transaction.traveler,
            email: this.maskEmail(transaction.traveler?.email ?? ''),
          };

    return {
      ...transaction,
      sender: maskedSender,
      traveler: maskedTraveler,
      contactDetailsMasked: true,
    };
  }

  private async enrichTransactionsWithPricingDetails(
    transactions: TransactionWithRelations[],
  ) {
    if (transactions.length === 0) {
      return [];
    }

    const corridorCodes = Array.from(
      new Set(
        transactions
          .map((tx) => tx.corridor?.code)
          .filter((code): code is string => Boolean(code)),
      ),
    );

    const pricingConfigs =
      corridorCodes.length === 0
        ? []
        : await this.prisma.corridorPricingPaymentConfig.findMany({
            where: {
              corridorCode: { in: corridorCodes },
            },
            select: {
              corridorCode: true,
              settlementCurrency: true,
              senderPricePerKg: true,
              senderPriceBundle23kg: true,
              senderPriceBundle32kg: true,
            },
          });

    const pricingConfigMap = new Map(
      pricingConfigs.map((config) => [config.corridorCode, config]),
    );

    return transactions.map((tx) => {
      const corridorCode = tx.corridor?.code ?? null;
      const pricingConfig = corridorCode
        ? pricingConfigMap.get(corridorCode)
        : undefined;
      const weightKg = Number(tx.package?.weightKg ?? 0);

      const pricingDetails =
        corridorCode &&
        pricingConfig &&
        Number.isFinite(weightKg) &&
        weightKg > 0
          ? this.buildPricingDetailsFromData({
              corridorCode,
              weightKg,
              transactionAmount: Number(tx.amount),
              transactionCurrency: tx.currency,
              senderPricePerKg:
                pricingConfig.senderPricePerKg !== null &&
                pricingConfig.senderPricePerKg !== undefined
                  ? Number(pricingConfig.senderPricePerKg)
                  : null,
              senderPriceBundle23kg:
                pricingConfig.senderPriceBundle23kg !== null &&
                pricingConfig.senderPriceBundle23kg !== undefined
                  ? Number(pricingConfig.senderPriceBundle23kg)
                  : null,
              senderPriceBundle32kg:
                pricingConfig.senderPriceBundle32kg !== null &&
                pricingConfig.senderPriceBundle32kg !== undefined
                  ? Number(pricingConfig.senderPriceBundle32kg)
                  : null,
            })
          : null;

      return {
        ...tx,
        pricingDetails,
      };
    });
  }

  private async assertTransactionReadable(
    transactionId: string,
    actorUserId: string,
    actorRole: Role,
  ) {
    const where =
      actorRole === Role.ADMIN
        ? { id: transactionId }
        : {
            id: transactionId,
            OR: [{ senderId: actorUserId }, { travelerId: actorUserId }],
          };

    const transaction = await this.prisma.transaction.findFirst({
      where,
      select: { id: true, currency: true },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    return transaction;
  }

  private normalizeDeliveryCode(code: string): string {
    return String(code ?? '').trim();
  }

  private generateDeliveryCodeValue(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private buildDeliveryCodeHash(code: string, salt: string): string {
    return createHash('sha256').update(`${code}:${salt}`).digest('hex');
  }

  private buildDeliveryCodeExpiry(): Date {
    return new Date(
      Date.now() + TransactionService.DELIVERY_CODE_TTL_HOURS * 60 * 60 * 1000,
    );
  }

  private async issueDeliveryCode(transactionId: string) {
    const code = this.generateDeliveryCodeValue();
    const salt = randomBytes(16).toString('hex');
    const generatedAt = new Date();
    const expiresAt = this.buildDeliveryCodeExpiry();
    const hash = this.buildDeliveryCodeHash(code, salt);

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        deliveryCodeHash: hash,
        deliveryCodeSalt: salt,
        deliveryCodeGeneratedAt: generatedAt,
        deliveryCodeExpiresAt: expiresAt,
        deliveryCodeConsumedAt: null,
        deliveryConfirmedAt: null,
      },
    });

    return {
      code,
      generatedAt,
      expiresAt,
    };
  }

  private buildPostDepartureDisputeReason(input: {
    initiatedBy: 'SENDER' | 'TRAVELER';
    actorRole: Role;
  }): string {
    const { initiatedBy, actorRole } = input;

    if (initiatedBy === 'SENDER') {
      return actorRole === Role.ADMIN
        ? 'POST_DEPARTURE_BLOCKING | initiatedBy=SENDER | triggeredBy=ADMIN'
        : 'POST_DEPARTURE_BLOCKING | initiatedBy=SENDER | triggeredBy=SENDER';
    }

    return actorRole === Role.ADMIN
      ? 'POST_DEPARTURE_BLOCKING | initiatedBy=TRAVELER | triggeredBy=ADMIN'
      : 'POST_DEPARTURE_BLOCKING | initiatedBy=TRAVELER | triggeredBy=TRAVELER';
  }

  private async ensureOpenPostDepartureDispute(input: {
    transactionId: string;
    openedById: string;
    initiatedBy: 'SENDER' | 'TRAVELER';
    actorRole: Role;
  }) {
    const { transactionId, openedById, initiatedBy, actorRole } = input;

    return this.prisma.$transaction(async (dbTx: any) => {
      const existingOpenDispute = await dbTx.dispute.findFirst({
        where: {
          transactionId,
          status: DisputeStatus.OPEN,
        },
      });

      if (existingOpenDispute) {
        return {
          dispute: existingOpenDispute,
          created: false,
        };
      }

      const dispute = await dbTx.dispute.create({
        data: {
          transactionId,
          openedById,
          reason: this.buildPostDepartureDisputeReason({
            initiatedBy,
            actorRole,
          }),
          reasonCode: DisputeReasonCode.OTHER,
          status: DisputeStatus.OPEN,
        },
      });

      return {
        dispute,
        created: true,
      };
    });
  }

  async create(
    senderId: string,
    dto: CreateTransactionDto,
  ): Promise<CreateTransactionResponse> {
    if (!senderId) {
      throw new BadRequestException('senderId is required');
    }
    if (!dto?.tripId || !dto?.packageId) {
      throw new BadRequestException('tripId and packageId are required');
    }

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { id: true },
    });
    if (!sender) {
      throw new NotFoundException(`Sender ${senderId} not found`);
    }

    const created = await this.prisma.$transaction(async (dbTx) => {
      const trip = await dbTx.trip.findUnique({
        where: { id: dto.tripId },
        select: {
          id: true,
          status: true,
          carrierId: true,
          corridorId: true,
        },
      });
      if (!trip) {
        throw new NotFoundException('Trip not found');
      }

      if (trip.status !== 'ACTIVE') {
        throw new BadRequestException('Trip must be ACTIVE');
      }

      const pkg = await dbTx.package.findUnique({
        where: { id: dto.packageId },
        select: {
          id: true,
          senderId: true,
          status: true,
          corridorId: true,
          weightKg: true,
        },
      });
      if (!pkg) {
        throw new NotFoundException('Package not found');
      }

      if (pkg.senderId !== senderId) {
        throw new ForbiddenException('You are not the sender of this package');
      }

      if (pkg.status !== 'PUBLISHED') {
        throw new BadRequestException('Package must be PUBLISHED');
      }

      if (pkg.corridorId !== trip.corridorId) {
        throw new BadRequestException('Trip and Package corridors do not match');
      }

      if (!pkg.weightKg || Number(pkg.weightKg) <= 0) {
        throw new BadRequestException(
          'Package weightKg must be defined and positive',
        );
      }

      const existing = await dbTx.transaction.findFirst({
        where: {
          packageId: pkg.id,
          NOT: { status: TransactionStatus.CANCELLED },
        },
        select: { id: true, status: true },
      });

      if (existing) {
        throw new BadRequestException(
          `Package already linked to a transaction (${existing.status})`,
        );
      }

      const corridor = await dbTx.corridor.findUnique({
        where: { id: trip.corridorId },
        select: { code: true, id: true },
      });

      if (!corridor) {
        throw new NotFoundException('Corridor not found');
      }

      const pricingConfig = await dbTx.corridorPricingPaymentConfig.findUnique({
        where: { corridorCode: corridor.code },
        select: {
          settlementCurrency: true,
          senderPricePerKg: true,
          senderPriceBundle23kg: true,
          senderPriceBundle32kg: true,
          isActive: true,
          isVisible: true,
          isBookable: true,
          requiresManualReview: true,
        },
      });

      if (!pricingConfig) {
        throw new BadRequestException({
          code: 'PRICING_CONFIG_NOT_FOUND',
          message: `No pricing config found for corridor ${corridor.code}.`,
          corridorCode: corridor.code,
        });
      }

      if (!pricingConfig.isActive) {
        throw new BadRequestException({
          code: 'PRICING_CONFIG_INACTIVE',
          message: `Pricing config for corridor ${corridor.code} is inactive.`,
          corridorCode: corridor.code,
        });
      }

      if (!pricingConfig.isVisible) {
        throw new BadRequestException({
          code: 'PRICING_CONFIG_NOT_VISIBLE',
          message: `Pricing config for corridor ${corridor.code} is not visible.`,
          corridorCode: corridor.code,
        });
      }

      if (!pricingConfig.isBookable) {
        throw new BadRequestException({
          code: 'PRICING_CONFIG_NOT_BOOKABLE',
          message: `Pricing config for corridor ${corridor.code} is not bookable.`,
          corridorCode: corridor.code,
        });
      }

      if (pricingConfig.requiresManualReview) {
        throw new BadRequestException({
          code: 'PRICING_CONFIG_REQUIRES_MANUAL_REVIEW',
          message: `Pricing config for corridor ${corridor.code} requires manual review before booking.`,
          corridorCode: corridor.code,
        });
      }

      const transactionCurrency = pricingConfig.settlementCurrency ?? 'XAF';

      const senderPricePerKg =
        pricingConfig.senderPricePerKg !== null &&
        pricingConfig.senderPricePerKg !== undefined
          ? Number(pricingConfig.senderPricePerKg)
          : null;

      const senderPriceBundle23kg =
        pricingConfig.senderPriceBundle23kg !== null &&
        pricingConfig.senderPriceBundle23kg !== undefined
          ? Number(pricingConfig.senderPriceBundle23kg)
          : null;

      const senderPriceBundle32kg =
        pricingConfig.senderPriceBundle32kg !== null &&
        pricingConfig.senderPriceBundle32kg !== undefined
          ? Number(pricingConfig.senderPriceBundle32kg)
          : null;

      const automaticPricing = this.computeAutomaticAmount({
        weightKg: Number(pkg.weightKg),
        senderPricePerKg,
        senderPriceBundle23kg,
        senderPriceBundle32kg,
      });

      if (
        transactionCurrency === 'XAF' &&
        automaticPricing.amount > TransactionService.MAX_PER_TX_VERIFIED_XAF
      ) {
        throw new BadRequestException({
          code: 'LIMIT_EXCEEDED',
          message: `Amount exceeds per-transaction limit (${TransactionService.MAX_PER_TX_VERIFIED_XAF} XAF).`,
          amount: automaticPricing.amount,
          maxAllowed: TransactionService.MAX_PER_TX_VERIFIED_XAF,
        });
      }

      await dbTx.package.update({
        where: { id: pkg.id },
        data: { status: 'RESERVED' as any },
      });

      const transaction = await dbTx.transaction.create({
        data: {
          senderId,
          travelerId: trip.carrierId,
          tripId: trip.id,
          packageId: pkg.id,
          corridorId: trip.corridorId,
          amount: automaticPricing.amount,
          commission: 0,
          escrowAmount: 0,
          currency: transactionCurrency,
          status: TransactionStatus.CREATED,
          paymentStatus: PaymentStatus.PENDING,
        },
      });

      return {
        transaction,
        pricingDetails: {
          corridorCode: corridor.code,
          weightKg: Number(pkg.weightKg),
          pricingModelApplied: automaticPricing.pricingModel,
          computedAmount: automaticPricing.amount,
          settlementCurrency: transactionCurrency,
          senderPricePerKg,
          senderPriceBundle23kg,
          senderPriceBundle32kg,
        },
      };
    });

    await this.abandonment.markAbandoned(
      { userId: senderId, role: 'USER' },
      {
        kind: AbandonmentKind.PAYMENT_PENDING,
        transactionId: created.transaction.id,
        metadata: {
          step: 'transaction_created',
          amount: created.transaction.amount,
          currency: created.transaction.currency,
          corridorCode: created.pricingDetails.corridorCode,
          pricingModelApplied: created.pricingDetails.pricingModelApplied,
          weightKg: created.pricingDetails.weightKg,
        },
      },
    );

    return created;
  }

  async findAll(actorUserId: string, actorRole: Role) {
    const where =
      actorRole === Role.ADMIN
        ? undefined
        : {
            OR: [{ senderId: actorUserId }, { travelerId: actorUserId }],
          };

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: this.buildTransactionInclude(),
    });

    const enriched = await this.enrichTransactionsWithPricingDetails(
      transactions as TransactionWithRelations[],
    );

    return enriched.map((tx) =>
      this.applyPrePaymentVisibility(tx, actorUserId, actorRole),
    );
  }

  async findOne(id: string, actorUserId: string, actorRole: Role) {
    const where =
      actorRole === Role.ADMIN
        ? { id }
        : {
            id,
            OR: [{ senderId: actorUserId }, { travelerId: actorUserId }],
          };

    const transaction = await this.prisma.transaction.findFirst({
      where,
      include: this.buildTransactionInclude(),
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    const [enriched] = await this.enrichTransactionsWithPricingDetails([
      transaction as TransactionWithRelations,
    ]);

    return this.applyPrePaymentVisibility(enriched, actorUserId, actorRole);
  }

  async updateStatus(id: string, status: TransactionStatus) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    TransactionStateMachine.assertCanTransition(tx.status, status);

    if (
      status === TransactionStatus.CANCELLED &&
      tx.paymentStatus === PaymentStatus.SUCCESS
    ) {
      throw new BadRequestException(
        'Paid transactions cannot be cancelled through the generic status endpoint. Use the dedicated cancellation or dispute flow.',
      );
    }

    if (status === TransactionStatus.DELIVERED) {
      throw new BadRequestException(
        'DELIVERED must be confirmed through the delivery code flow',
      );
    }

    if (status === TransactionStatus.IN_TRANSIT) {
      throw new BadRequestException(
        'IN_TRANSIT is not used in the current V1 operational flow',
      );
    }

    return this.prisma.transaction.update({
      where: { id },
      data: { status },
    });
  }

  async cancelBeforeDeparture(
    id: string,
    actorUserId: string,
    actorRole: Role,
  ) {
    const tx = await this.prisma.transaction.findFirst({
      where: { id },
      include: {
        payout: true,
      },
    });

    if (!tx) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    if (actorRole !== Role.ADMIN && tx.senderId !== actorUserId) {
      throw new ForbiddenException(
        'Only the sender or an admin can cancel before departure',
      );
    }

    if (tx.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException(
        'Pre-departure cancellation is only available for paid transactions',
      );
    }

    if (tx.status !== TransactionStatus.PAID) {
      throw new BadRequestException(
        'Pre-departure cancellation is only available while transaction status is PAID',
      );
    }

    if (
      tx.payout &&
      (tx.payout.status === 'REQUESTED' ||
        tx.payout.status === 'PROCESSING' ||
        tx.payout.status === 'PAID')
    ) {
      throw new BadRequestException(
        'Cannot cancel before departure: payout flow has already started',
      );
    }

    const escrowBalance =
      Number(tx.escrowAmount) > 0
        ? Number(tx.escrowAmount)
        : await this.ledger.getEscrowBalance(id);

    if (!Number.isFinite(escrowBalance) || escrowBalance <= 0) {
      throw new BadRequestException(
        'Cannot cancel before departure: refundable escrow balance is 0',
      );
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (dbTx) => {
      const updatedTransaction = await dbTx.transaction.update({
        where: { id },
        data: {
          status: TransactionStatus.CANCELLED,
        },
      });

      const existingRefund = await dbTx.refund.findUnique({
        where: { transactionId: id },
      });

      if (
        existingRefund &&
        (existingRefund.status === RefundStatus.REQUESTED ||
          existingRefund.status === RefundStatus.PROCESSING ||
          existingRefund.status === RefundStatus.REFUNDED)
      ) {
        return {
          transaction: updatedTransaction,
          refund: existingRefund,
        };
      }

      const refundData = {
        provider: RefundProvider.MANUAL,
        status: RefundStatus.REQUESTED,
        amount: escrowBalance,
        currency: tx.currency,
        failureReason: null,
        externalReference: null,
        requestedAt: now,
        processedAt: null,
        refundedAt: null,
        idempotencyKey: `cancel_before_departure_refund_request:${id}`,
        metadata: {
          createdFrom: 'transaction.cancel_before_departure',
          reason: 'sender_cancel_before_departure',
          initiatedByUserId: actorUserId,
          initiatedByRole: actorRole,
        } as any,
      };

      const refund = existingRefund
        ? await dbTx.refund.update({
            where: { id: existingRefund.id },
            data: refundData,
          })
        : await dbTx.refund.create({
            data: {
              transactionId: id,
              ...refundData,
            },
          });

      return {
        transaction: updatedTransaction,
        refund,
      };
    });

    return {
      transaction: result.transaction,
      refund: result.refund,
      refundAmount: escrowBalance,
      message:
        'Pre-departure cancellation accepted. Manual refund request created.',
    };
  }

  async cancelBeforeDepartureByTraveler(
    id: string,
    actorUserId: string,
    actorRole: Role,
  ) {
    const tx = await this.prisma.transaction.findFirst({
      where: { id },
      include: {
        payout: true,
      },
    });

    if (!tx) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    if (actorRole !== Role.ADMIN && tx.travelerId !== actorUserId) {
      throw new ForbiddenException(
        'Only the traveler or an admin can cancel before departure as traveler',
      );
    }

    if (tx.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException(
        'Traveler pre-departure cancellation is only available for paid transactions',
      );
    }

    if (tx.status !== TransactionStatus.PAID) {
      throw new BadRequestException(
        'Traveler pre-departure cancellation is only available while transaction status is PAID',
      );
    }

    if (
      tx.payout &&
      (tx.payout.status === 'REQUESTED' ||
        tx.payout.status === 'PROCESSING' ||
        tx.payout.status === 'PAID')
    ) {
      throw new BadRequestException(
        'Cannot cancel before departure as traveler: payout flow has already started',
      );
    }

    const escrowBalance =
      Number(tx.escrowAmount) > 0
        ? Number(tx.escrowAmount)
        : await this.ledger.getEscrowBalance(id);

    if (!Number.isFinite(escrowBalance) || escrowBalance <= 0) {
      throw new BadRequestException(
        'Cannot cancel before departure as traveler: refundable escrow balance is 0',
      );
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (dbTx) => {
      const updatedTransaction = await dbTx.transaction.update({
        where: { id },
        data: {
          status: TransactionStatus.CANCELLED,
        },
      });

      const existingRefund = await dbTx.refund.findUnique({
        where: { transactionId: id },
      });

      if (
        existingRefund &&
        (existingRefund.status === RefundStatus.REQUESTED ||
          existingRefund.status === RefundStatus.PROCESSING ||
          existingRefund.status === RefundStatus.REFUNDED)
      ) {
        return {
          transaction: updatedTransaction,
          refund: existingRefund,
        };
      }

      const refundData = {
        provider: RefundProvider.MANUAL,
        status: RefundStatus.REQUESTED,
        amount: escrowBalance,
        currency: tx.currency,
        failureReason: null,
        externalReference: null,
        requestedAt: now,
        processedAt: null,
        refundedAt: null,
        idempotencyKey: `traveler_cancel_before_departure_refund_request:${id}`,
        metadata: {
          createdFrom: 'transaction.cancel_before_departure.traveler',
          reason: 'traveler_cancel_before_departure',
          initiatedByUserId: actorUserId,
          initiatedByRole: actorRole,
        } as any,
      };

      const refund = existingRefund
        ? await dbTx.refund.update({
            where: { id: existingRefund.id },
            data: refundData,
          })
        : await dbTx.refund.create({
            data: {
              transactionId: id,
              ...refundData,
            },
          });

      return {
        transaction: updatedTransaction,
        refund,
      };
    });

    return {
      transaction: result.transaction,
      refund: result.refund,
      refundAmount: escrowBalance,
      message:
        'Traveler pre-departure cancellation accepted. Manual refund request created.',
    };
  }

  async blockAfterDeparture(
    id: string,
    actorUserId: string,
    actorRole: Role,
  ) {
    const tx = await this.prisma.transaction.findFirst({
      where: { id },
      select: {
        id: true,
        senderId: true,
        travelerId: true,
        paymentStatus: true,
        status: true,
        trip: {
          select: {
            departAt: true,
          },
        },
      },
    });

    if (!tx) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    if (actorRole !== Role.ADMIN && tx.senderId !== actorUserId) {
      throw new ForbiddenException(
        'Only the sender or an admin can request post-departure blocking',
      );
    }

    if (tx.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException(
        'Post-departure blocking is only available for paid transactions',
      );
    }

    if (!tx.trip?.departAt) {
      throw new BadRequestException(
        'Cannot evaluate post-departure blocking: trip departure date is missing',
      );
    }

    if (tx.trip.departAt.getTime() > Date.now()) {
      throw new BadRequestException(
        'Post-departure blocking is only available after the trip departure time',
      );
    }

    if (tx.status === TransactionStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot block post-departure: transaction is already CANCELLED',
      );
    }

    if (tx.status === TransactionStatus.DELIVERED) {
      throw new BadRequestException(
        'Cannot block post-departure through this flow once delivery is confirmed',
      );
    }

    if (tx.status === TransactionStatus.DISPUTED) {
      const disputeBridge = await this.ensureOpenPostDepartureDispute({
        transactionId: id,
        openedById: actorUserId,
        initiatedBy: 'SENDER',
        actorRole,
      });

      return {
        transaction: tx,
        dispute: disputeBridge.dispute,
        automaticRefundTriggered: false,
        automaticPayoutTriggered: false,
        message: disputeBridge.created
          ? 'Transaction was already DISPUTED. A missing OPEN dispute has now been created for manual review. No automatic refund or payout has been triggered.'
          : 'Transaction is already blocked for post-departure review. Existing OPEN dispute reused. No automatic refund or payout has been triggered.',
      };
    }

    if (tx.status !== TransactionStatus.PAID) {
      throw new BadRequestException(
        'Post-departure blocking is only available while transaction status is PAID',
      );
    }

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        status: TransactionStatus.DISPUTED,
      },
    });

    const disputeBridge = await this.ensureOpenPostDepartureDispute({
      transactionId: id,
      openedById: actorUserId,
      initiatedBy: 'SENDER',
      actorRole,
    });

    return {
      transaction: updated,
      dispute: disputeBridge.dispute,
      automaticRefundTriggered: false,
      automaticPayoutTriggered: false,
      message: disputeBridge.created
        ? 'Post-departure blocking accepted. Transaction moved to DISPUTED and an OPEN dispute has been created for manual review. No automatic refund or payout has been triggered.'
        : 'Post-departure blocking accepted. Transaction moved to DISPUTED and an existing OPEN dispute has been reused for manual review. No automatic refund or payout has been triggered.',
    };
  }

  async blockAfterDepartureByTraveler(
    id: string,
    actorUserId: string,
    actorRole: Role,
  ) {
    const tx = await this.prisma.transaction.findFirst({
      where: { id },
      select: {
        id: true,
        senderId: true,
        travelerId: true,
        paymentStatus: true,
        status: true,
        trip: {
          select: {
            departAt: true,
          },
        },
      },
    });

    if (!tx) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    if (actorRole !== Role.ADMIN && tx.travelerId !== actorUserId) {
      throw new ForbiddenException(
        'Only the traveler or an admin can request traveler-side post-departure blocking',
      );
    }

    if (tx.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException(
        'Traveler-side post-departure blocking is only available for paid transactions',
      );
    }

    if (!tx.trip?.departAt) {
      throw new BadRequestException(
        'Cannot evaluate traveler-side post-departure blocking: trip departure date is missing',
      );
    }

    if (tx.trip.departAt.getTime() > Date.now()) {
      throw new BadRequestException(
        'Traveler-side post-departure blocking is only available after the trip departure time',
      );
    }

    if (tx.status === TransactionStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot block post-departure as traveler: transaction is already CANCELLED',
      );
    }

    if (tx.status === TransactionStatus.DELIVERED) {
      throw new BadRequestException(
        'Cannot block post-departure as traveler through this flow once delivery is confirmed',
      );
    }

    if (tx.status === TransactionStatus.DISPUTED) {
      const disputeBridge = await this.ensureOpenPostDepartureDispute({
        transactionId: id,
        openedById: actorUserId,
        initiatedBy: 'TRAVELER',
        actorRole,
      });

      return {
        transaction: tx,
        dispute: disputeBridge.dispute,
        automaticRefundTriggered: false,
        automaticPayoutTriggered: false,
        message: disputeBridge.created
          ? 'Transaction was already DISPUTED. A missing OPEN dispute has now been created for manual review. No automatic refund or payout has been triggered.'
          : 'Transaction is already blocked for post-departure review. Existing OPEN dispute reused. No automatic refund or payout has been triggered.',
      };
    }

    if (tx.status !== TransactionStatus.PAID) {
      throw new BadRequestException(
        'Traveler-side post-departure blocking is only available while transaction status is PAID',
      );
    }

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        status: TransactionStatus.DISPUTED,
      },
    });

    const disputeBridge = await this.ensureOpenPostDepartureDispute({
      transactionId: id,
      openedById: actorUserId,
      initiatedBy: 'TRAVELER',
      actorRole,
    });

    return {
      transaction: updated,
      dispute: disputeBridge.dispute,
      automaticRefundTriggered: false,
      automaticPayoutTriggered: false,
      message: disputeBridge.created
        ? 'Traveler-side post-departure blocking accepted. Transaction moved to DISPUTED and an OPEN dispute has been created for manual review. No automatic refund or payout has been triggered.'
        : 'Traveler-side post-departure blocking accepted. Transaction moved to DISPUTED and an existing OPEN dispute has been reused for manual review. No automatic refund or payout has been triggered.',
    };
  }

  async generateDeliveryCode(
    id: string,
    actorUserId: string,
    actorRole: Role,
  ) {
    const where =
      actorRole === Role.ADMIN
        ? { id }
        : {
            id,
            OR: [{ senderId: actorUserId }, { travelerId: actorUserId }],
          };

    const tx = await this.prisma.transaction.findFirst({
      where,
      select: {
        id: true,
        senderId: true,
        travelerId: true,
        status: true,
        paymentStatus: true,
      },
    });

    if (!tx) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    if (actorRole !== Role.ADMIN && tx.senderId !== actorUserId) {
      throw new ForbiddenException(
        'Only the sender or an admin can generate the delivery code',
      );
    }

    if (tx.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException(
        'Cannot generate delivery code: paymentStatus is not SUCCESS',
      );
    }

    if (tx.status !== TransactionStatus.PAID) {
      throw new BadRequestException(
        'Cannot generate delivery code: transaction must be PAID',
      );
    }

    const issued = await this.issueDeliveryCode(id);

    return {
      transactionId: id,
      code: issued.code,
      generatedAt: issued.generatedAt,
      expiresAt: issued.expiresAt,
    };
  }

  async confirmDeliveryWithCode(
    id: string,
    actorUserId: string,
    actorRole: Role,
    code: string,
  ) {
    const normalizedCode = this.normalizeDeliveryCode(code);

    if (!/^\d{6}$/.test(normalizedCode)) {
      throw new BadRequestException(
        'Delivery code must be a 6-digit numeric string',
      );
    }

    const where =
      actorRole === Role.ADMIN
        ? { id }
        : {
            id,
            OR: [{ senderId: actorUserId }, { travelerId: actorUserId }],
          };

    const tx = await this.prisma.transaction.findFirst({
      where,
      select: {
        id: true,
        senderId: true,
        travelerId: true,
        status: true,
        paymentStatus: true,
        deliveryCodeHash: true,
        deliveryCodeSalt: true,
        deliveryCodeGeneratedAt: true,
        deliveryCodeExpiresAt: true,
        deliveryCodeConsumedAt: true,
      },
    });

    if (!tx) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    if (actorRole !== Role.ADMIN && tx.travelerId !== actorUserId) {
      throw new ForbiddenException(
        'Only the traveler or an admin can confirm delivery with code',
      );
    }

    if (tx.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException(
        'Cannot confirm delivery: paymentStatus is not SUCCESS',
      );
    }

    if (tx.status !== TransactionStatus.PAID) {
      throw new BadRequestException(
        'Cannot confirm delivery: transaction must be PAID',
      );
    }

    if (
      !tx.deliveryCodeHash ||
      !tx.deliveryCodeSalt ||
      !tx.deliveryCodeGeneratedAt ||
      !tx.deliveryCodeExpiresAt
    ) {
      throw new BadRequestException(
        'No active delivery code found for this transaction',
      );
    }

    if (tx.deliveryCodeConsumedAt) {
      throw new BadRequestException(
        'Delivery code has already been consumed for this transaction',
      );
    }

    if (tx.deliveryCodeExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Delivery code has expired');
    }

    const expectedHash = this.buildDeliveryCodeHash(
      normalizedCode,
      tx.deliveryCodeSalt,
    );

    if (expectedHash !== tx.deliveryCodeHash) {
      throw new BadRequestException('Invalid delivery code');
    }

    const now = new Date();

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        status: TransactionStatus.DELIVERED,
        deliveryConfirmedAt: now,
        deliveryCodeConsumedAt: now,
      },
      select: {
        id: true,
        status: true,
        deliveryConfirmedAt: true,
        deliveryCodeConsumedAt: true,
      },
    });

    const payout = await this.payoutService.requestPayoutForTransaction(id);

    return {
      transactionId: updated.id,
      status: updated.status,
      deliveryConfirmedAt: updated.deliveryConfirmedAt as Date,
      deliveryCodeConsumedAt: updated.deliveryCodeConsumedAt as Date,
      payoutRequestTriggered: true,
      payoutId: payout?.id ?? null,
      payoutStatus: payout?.status ?? null,
    };
  }

  async markPayment(
    id: string,
    paymentStatus: PaymentStatus,
  ): Promise<Transaction | MarkPaymentSuccessResponse> {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    if (
      tx.paymentStatus === PaymentStatus.SUCCESS &&
      paymentStatus === PaymentStatus.SUCCESS
    ) {
      return tx;
    }

    if (paymentStatus === PaymentStatus.SUCCESS) {
      const traveler = await this.prisma.user.findUnique({
        where: { id: tx.travelerId },
        select: { id: true, kycStatus: true },
      });

      if (!traveler) {
        throw new NotFoundException(`Traveler ${tx.travelerId} not found`);
      }

      if (traveler.kycStatus !== KycStatus.VERIFIED) {
        throw new BadRequestException({
          code: 'KYC_REQUIRED',
          message:
            'Traveler KYC must be VERIFIED before payment can be confirmed.',
          nextStep: 'KYC',
          nextStepUrl: '/kyc',
          travelerId: traveler.id,
          kycStatus: traveler.kycStatus,
        });
      }

      if (
        tx.currency === 'XAF' &&
        tx.amount > TransactionService.MAX_PER_TX_VERIFIED_XAF
      ) {
        throw new BadRequestException({
          code: 'LIMIT_EXCEEDED',
          message: `Amount exceeds per-transaction limit (${TransactionService.MAX_PER_TX_VERIFIED_XAF} XAF).`,
          amount: tx.amount,
          maxAllowed: TransactionService.MAX_PER_TX_VERIFIED_XAF,
        });
      }
    }

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        paymentStatus,
        status:
          paymentStatus === PaymentStatus.SUCCESS
            ? TransactionStatus.PAID
            : tx.status,
        escrowAmount:
          paymentStatus === PaymentStatus.SUCCESS ? tx.amount : tx.escrowAmount,
      },
    });

    if (paymentStatus === PaymentStatus.SUCCESS) {
      await this.ledger.addEntryIdempotent({
        transactionId: id,
        type: LedgerEntryType.ESCROW_CREDIT,
        amount: tx.amount,
        currency: tx.currency,
        note: 'Payment confirmed: escrow credited',
        idempotencyKey: `payment_success:${id}`,
        source: LedgerSource.PAYMENT,
        referenceType: LedgerReferenceType.PAYMENT,
        referenceId: `payment_success:${id}`,
        actorUserId: null,
      });

      await this.abandonment.resolveActiveByReference({
        userId: tx.senderId,
        kind: AbandonmentKind.PAYMENT_PENDING,
        transactionId: tx.id,
      });

      const deliveryCode = await this.issueDeliveryCode(id);

      return {
        transaction: updated,
        deliveryCode,
      };
    }

    await this.abandonment.markAbandoned(
      { userId: tx.senderId, role: 'USER' },
      {
        kind: AbandonmentKind.PAYMENT_PENDING,
        transactionId: tx.id,
        metadata: {
          step: 'payment_not_completed',
          paymentStatus,
          currency: tx.currency,
        },
      },
    );

    return updated;
  }

  async releaseFunds(id: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id },
      include: { payout: true },
    });
    if (!tx) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    if (tx.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestException(
        'Cannot request payout: paymentStatus is not SUCCESS',
      );
    }
    if (tx.status !== TransactionStatus.DELIVERED) {
      throw new BadRequestException(
        'Cannot request payout: transaction must be DELIVERED',
      );
    }

    const balance = await this.ledger.getEscrowBalance(id);
    if (balance <= 0) {
      return {
        ok: true,
        transactionId: id,
        payout: tx.payout ?? null,
        releasedAmount: 0,
        escrowBalance: balance,
        currency: tx.currency,
      };
    }

    const payout = await this.payoutService.requestPayoutForTransaction(id);

    return {
      ok: true,
      transactionId: id,
      payout,
      releasedAmount: 0,
      escrowBalance: balance,
      currency: tx.currency,
      message:
        'Payout requested. Escrow will be debited only when payout is marked PAID.',
    };
  }

  async getLedger(id: string, actorUserId: string, actorRole: Role) {
    const tx = await this.assertTransactionReadable(id, actorUserId, actorRole);

    const entries = await this.ledger.listByTransaction(id);

    return {
      transactionId: id,
      transactionCurrency: tx.currency,
      entries: entries.map((e: any) => ({
        type: e.type,
        amount: e.amount,
        currency: e.currency,
        createdAt: e.createdAt,
        note: e.note ?? null,
        idempotencyKey: e.idempotencyKey ?? null,
        source: e.source ?? null,
        referenceType: e.referenceType ?? null,
        referenceId: e.referenceId ?? null,
        actorUserId: e.actorUserId ?? null,
      })),
    };
  }
}