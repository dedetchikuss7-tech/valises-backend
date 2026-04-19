import { createHash, randomBytes, randomInt } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AbandonmentKind,
  DisputeOpeningSource,
  DisputeReasonCode,
  DisputeStatus,
  KycStatus,
  LedgerEntryType,
  LedgerReferenceType,
  LedgerSource,
  PackageContentComplianceStatus,
  PaymentMethodType,
  PaymentRailProvider,
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
import { buildKycRequirementErrorPayload } from '../kyc/kyc-gating';
import { TrustService } from '../trust/trust.service';

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
  payinRailProvider?: PaymentRailProvider | null;
  payinMethodType?: PaymentMethodType | null;
  payinProviderReference?: string | null;
  paymentConfirmedAt?: Date | null;
  paymentMetadata?: any;
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
    handoverDeclaredAt?: Date | null;
    handoverDeclaredById?: string | null;
    handoverNotes?: string | null;
    travelerResponsibilityAcknowledgedAt?: Date | null;
    travelerResponsibilityAcknowledgedById?: string | null;
    contentCategory?: string | null;
    contentSummary?: string | null;
    declaredItemCount?: number | null;
    declaredValueAmount?: any;
    declaredValueCurrency?: string | null;
    containsFragileItems?: boolean;
    containsLiquid?: boolean;
    containsElectronic?: boolean;
    containsBattery?: boolean;
    containsMedicine?: boolean;
    containsPerishableItems?: boolean;
    containsValuableItems?: boolean;
    containsDocuments?: boolean;
    containsProhibitedItems?: boolean;
    prohibitedItemsDeclarationAcceptedAt?: Date | null;
    prohibitedItemsDeclarationAcceptedById?: string | null;
    contentDeclaredAt?: Date | null;
    contentDeclaredById?: string | null;
    contentComplianceStatus?: PackageContentComplianceStatus;
    contentComplianceNotes?: string | null;
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
    @Optional()
    private readonly trustService?: TrustService,
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

  private parseStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private resolvePreferredPayinMethod(
    value: unknown,
  ): PaymentMethodType | null {
    const methods = this.parseStringArray(value);

    if (methods.includes(PaymentMethodType.CARD)) {
      return PaymentMethodType.CARD;
    }

    if (methods.includes(PaymentMethodType.MOBILE_MONEY)) {
      return PaymentMethodType.MOBILE_MONEY;
    }

    if (methods.includes(PaymentMethodType.BANK_TRANSFER)) {
      return PaymentMethodType.BANK_TRANSFER;
    }

    return null;
  }

  private async resolvePayinRoutingForCorridor(
    corridorId?: string | null,
  ): Promise<{
    payinRailProvider: PaymentRailProvider | null;
    payinMethodType: PaymentMethodType | null;
    corridorCode: string | null;
  }> {
    if (!corridorId) {
      return {
        payinRailProvider: null,
        payinMethodType: null,
        corridorCode: null,
      };
    }

    const corridor = await this.prisma.corridor.findUnique({
      where: { id: corridorId },
      select: { code: true },
    });

    if (!corridor) {
      return {
        payinRailProvider: null,
        payinMethodType: null,
        corridorCode: null,
      };
    }

    const pricingConfig =
      await this.prisma.corridorPricingPaymentConfig.findUnique({
        where: { corridorCode: corridor.code },
        select: {
          payinPrimaryRail: true,
          fallbackRail: true,
          payinMethodsAllowed: true,
        },
      });

    return {
      payinRailProvider:
        pricingConfig?.payinPrimaryRail ?? pricingConfig?.fallbackRail ?? null,
      payinMethodType: this.resolvePreferredPayinMethod(
        pricingConfig?.payinMethodsAllowed ?? null,
      ),
      corridorCode: corridor.code,
    };
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
          handoverDeclaredAt: true,
          handoverDeclaredById: true,
          handoverNotes: true,
          travelerResponsibilityAcknowledgedAt: true,
          travelerResponsibilityAcknowledgedById: true,
          contentCategory: true,
          contentSummary: true,
          declaredItemCount: true,
          declaredValueAmount: true,
          declaredValueCurrency: true,
          containsFragileItems: true,
          containsLiquid: true,
          containsElectronic: true,
          containsBattery: true,
          containsMedicine: true,
          containsPerishableItems: true,
          containsValuableItems: true,
          containsDocuments: true,
          containsProhibitedItems: true,
          prohibitedItemsDeclarationAcceptedAt: true,
          prohibitedItemsDeclarationAcceptedById: true,
          contentDeclaredAt: true,
          contentDeclaredById: true,
          contentComplianceStatus: true,
          contentComplianceNotes: true,
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

  private buildPayoutSnapshot(payout: any) {
    if (!payout) {
      return null;
    }

    return {
      id: payout.id,
      status: payout.status,
      provider: payout.provider,
      railProvider: payout.railProvider ?? null,
      payoutMethodType: payout.payoutMethodType ?? null,
      amount: payout.amount,
      currency: payout.currency,
      externalReference: payout.externalReference ?? null,
    };
  }

  private buildRefundSnapshot(refund: any) {
    if (!refund) {
      return null;
    }

    return {
      id: refund.id,
      status: refund.status,
      provider: refund.provider,
      amount: refund.amount,
      currency: refund.currency,
    };
  }

  private buildDisputeSnapshot(dispute: any) {
    if (!dispute) {
      return null;
    }

    return {
      id: dispute.id,
      status: dispute.status,
      reasonCode: dispute.reasonCode,
      openingSource: dispute.openingSource,
      openedById: dispute.openedById,
      createdAt: dispute.createdAt,
      resolutionOutcome: dispute.resolution?.outcome ?? null,
    };
  }

  private buildAdminOperationalSnapshot(input: {
    payout: any;
    refund: any;
    dispute: any;
  }) {
    const hasOpenDispute = input.dispute?.status === 'OPEN';

    const hasRequestedPayout =
      input.payout?.status === 'REQUESTED' ||
      input.payout?.status === 'PROCESSING';

    const hasRequestedRefund =
      input.refund?.status === 'REQUESTED' ||
      input.refund?.status === 'PROCESSING';

    return {
      hasOpenDispute,
      hasRequestedPayout,
      hasRequestedRefund,
      requiresAdminAttention:
        hasOpenDispute || hasRequestedPayout || hasRequestedRefund,
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

  private async enrichTransactionsWithOperationalSnapshots(
    transactions: any[],
  ) {
    if (transactions.length === 0) {
      return [];
    }

    const transactionIds = transactions.map((tx) => tx.id);

    const refunds = await this.prisma.refund.findMany({
      where: {
        transactionId: { in: transactionIds },
      },
      orderBy: { createdAt: 'desc' },
    });

    const disputes = await this.prisma.dispute.findMany({
      where: {
        transactionId: { in: transactionIds },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        resolution: true,
      },
    });

    const latestRefundByTransactionId = new Map<string, any>();
    for (const refund of refunds) {
      if (!latestRefundByTransactionId.has(refund.transactionId)) {
        latestRefundByTransactionId.set(refund.transactionId, refund);
      }
    }

    const latestDisputeByTransactionId = new Map<string, any>();
    for (const dispute of disputes) {
      if (!latestDisputeByTransactionId.has(dispute.transactionId)) {
        latestDisputeByTransactionId.set(dispute.transactionId, dispute);
      }
    }

    return transactions.map((tx) => {
      const refund = latestRefundByTransactionId.get(tx.id) ?? null;
      const dispute = latestDisputeByTransactionId.get(tx.id) ?? null;

      return {
        ...tx,
        payout: this.buildPayoutSnapshot(tx.payout ?? null),
        refund: this.buildRefundSnapshot(refund),
        dispute: this.buildDisputeSnapshot(dispute),
        adminOperationalSnapshot: this.buildAdminOperationalSnapshot({
          payout: tx.payout ?? null,
          refund,
          dispute,
        }),
      };
    });
  }

  private async enrichTransactionsForRead(
    transactions: TransactionWithRelations[],
  ) {
    const withPricing = await this.enrichTransactionsWithPricingDetails(
      transactions,
    );

    return this.enrichTransactionsWithOperationalSnapshots(withPricing);
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

  private async assertTravelerVerifiedForPaymentSuccess(travelerId: string) {
    const traveler = await this.prisma.user.findUnique({
      where: { id: travelerId },
      select: { id: true, kycStatus: true },
    });

    if (!traveler) {
      throw new NotFoundException(`Traveler ${travelerId} not found`);
    }

    if (traveler.kycStatus !== KycStatus.VERIFIED) {
      throw new BadRequestException(
        buildKycRequirementErrorPayload({
          userId: traveler.id,
          kycStatus: traveler.kycStatus,
          requiredFor: 'TRANSACTION_PAYMENT_SUCCESS_TRAVELER',
          message:
            'Traveler KYC must be VERIFIED before payment can be confirmed.',
          nextStepUrl: '/kyc',
        }),
      );
    }

    return traveler;
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

  private buildPostDepartureDisputeReason(
    initiatedBy: 'SENDER' | 'TRAVELER',
  ): string {
    if (initiatedBy === 'SENDER') {
      return 'Post-departure blocking requested from sender side. Manual review required.';
    }

    return 'Post-departure blocking requested from traveler side. Manual review required.';
  }

  private buildPostDepartureOpeningSource(
    initiatedBy: 'SENDER' | 'TRAVELER',
  ): DisputeOpeningSource {
    return initiatedBy === 'SENDER'
      ? DisputeOpeningSource.POST_DEPARTURE_BLOCK_SENDER
      : DisputeOpeningSource.POST_DEPARTURE_BLOCK_TRAVELER;
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

      const openingSource = this.buildPostDepartureOpeningSource(initiatedBy);

      const dispute = await dbTx.dispute.create({
        data: {
          transactionId,
          openedById,
          reason: this.buildPostDepartureDisputeReason(initiatedBy),
          reasonCode: DisputeReasonCode.OTHER,
          openingSource,
          initiatedBySide:
            initiatedBy === 'SENDER' ? 'SENDER' : 'TRAVELER',
          triggeredByRole: actorRole === Role.ADMIN ? 'ADMIN' : 'USER',
          status: DisputeStatus.OPEN,
        },
      });

      return {
        dispute,
        created: true,
        openingSource,
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
          contentComplianceStatus: true,
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

      if (
        pkg.contentComplianceStatus ===
        PackageContentComplianceStatus.NOT_DECLARED
      ) {
        throw new BadRequestException({
          code: 'PACKAGE_CONTENT_NOT_DECLARED',
          message:
            'Package content must be declared before the package can be booked into a transaction.',
          packageId: pkg.id,
        });
      }

      if (
        pkg.contentComplianceStatus === PackageContentComplianceStatus.BLOCKED
      ) {
        throw new BadRequestException({
          code: 'PACKAGE_CONTENT_BLOCKED',
          message:
            'Package contains prohibited items and cannot be booked into a transaction.',
          packageId: pkg.id,
        });
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

    const enriched = await this.enrichTransactionsForRead(
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

    const [enriched] = await this.enrichTransactionsForRead([
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

    await this.autoWireTrustForCancellation({
      transactionId: id,
      userId: tx.senderId,
      initiatedBy: 'SENDER',
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

    await this.autoWireTrustForCancellation({
      transactionId: id,
      userId: tx.travelerId,
      initiatedBy: 'TRAVELER',
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

      if (disputeBridge.created) {
        await this.autoWireTrustForDisputeOpened({
          transactionId: id,
          senderId: tx.senderId,
          travelerId: tx.travelerId,
          initiatedBy: 'SENDER',
          openingSource:
            disputeBridge.openingSource ??
            DisputeOpeningSource.POST_DEPARTURE_BLOCK_SENDER,
        });
      }

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

    if (disputeBridge.created) {
      await this.autoWireTrustForDisputeOpened({
        transactionId: id,
        senderId: tx.senderId,
        travelerId: tx.travelerId,
        initiatedBy: 'SENDER',
        openingSource:
          disputeBridge.openingSource ??
          DisputeOpeningSource.POST_DEPARTURE_BLOCK_SENDER,
      });
    }

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

      if (disputeBridge.created) {
        await this.autoWireTrustForDisputeOpened({
          transactionId: id,
          senderId: tx.senderId,
          travelerId: tx.travelerId,
          initiatedBy: 'TRAVELER',
          openingSource:
            disputeBridge.openingSource ??
            DisputeOpeningSource.POST_DEPARTURE_BLOCK_TRAVELER,
        });
      }

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

    if (disputeBridge.created) {
      await this.autoWireTrustForDisputeOpened({
        transactionId: id,
        senderId: tx.senderId,
        travelerId: tx.travelerId,
        initiatedBy: 'TRAVELER',
        openingSource:
          disputeBridge.openingSource ??
          DisputeOpeningSource.POST_DEPARTURE_BLOCK_TRAVELER,
      });
    }

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
        deliveryConfirmedAt: true,
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

    if (tx.status === TransactionStatus.DELIVERED || tx.deliveryConfirmedAt) {
      throw new BadRequestException(
        'Cannot generate delivery code: delivery already confirmed',
      );
    }

    if (tx.status === TransactionStatus.DISPUTED) {
      throw new BadRequestException(
        'Cannot generate delivery code: transaction is DISPUTED',
      );
    }

    if (tx.status !== TransactionStatus.PAID) {
      throw new BadRequestException(
        'Cannot generate delivery code: transaction must be PAID',
      );
    }

    const openDispute = await this.prisma.dispute.findFirst({
      where: {
        transactionId: id,
        status: DisputeStatus.OPEN,
      },
      select: { id: true },
    });

    if (openDispute) {
      throw new BadRequestException(
        'Cannot generate delivery code: open dispute exists for this transaction',
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
        deliveryConfirmedAt: true,
        payout: {
          select: {
            id: true,
            status: true,
          },
        },
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

    if (tx.status === TransactionStatus.DELIVERED || tx.deliveryConfirmedAt) {
      throw new BadRequestException(
        'Delivery already confirmed for this transaction',
      );
    }

    if (tx.status === TransactionStatus.DISPUTED) {
      throw new BadRequestException(
        'Cannot confirm delivery while transaction is DISPUTED',
      );
    }

    if (tx.status !== TransactionStatus.PAID) {
      throw new BadRequestException(
        'Cannot confirm delivery: transaction must be PAID',
      );
    }

    const openDispute = await this.prisma.dispute.findFirst({
      where: {
        transactionId: id,
        status: DisputeStatus.OPEN,
      },
      select: { id: true },
    });

    if (openDispute) {
      throw new BadRequestException(
        'Cannot confirm delivery: open dispute exists for this transaction',
      );
    }

    if (
      tx.payout &&
      (tx.payout.status === 'REQUESTED' ||
        tx.payout.status === 'PROCESSING' ||
        tx.payout.status === 'PAID')
    ) {
      throw new BadRequestException(
        'Cannot confirm delivery: payout flow has already started for this transaction',
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

    const updateResult = await this.prisma.transaction.updateMany({
      where: {
        id,
        status: TransactionStatus.PAID,
        paymentStatus: PaymentStatus.SUCCESS,
        deliveryCodeHash: tx.deliveryCodeHash,
        deliveryCodeSalt: tx.deliveryCodeSalt,
        deliveryCodeConsumedAt: null,
        deliveryConfirmedAt: null,
        deliveryCodeExpiresAt: {
          gte: now,
        },
      },
      data: {
        status: TransactionStatus.DELIVERED,
        deliveryConfirmedAt: now,
        deliveryCodeConsumedAt: now,
      },
    });

    if (updateResult.count !== 1) {
      throw new BadRequestException(
        'Delivery confirmation could not be completed because the delivery code is no longer active',
      );
    }

    const updated = await this.prisma.transaction.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        deliveryConfirmedAt: true,
        deliveryCodeConsumedAt: true,
      },
    });

    if (!updated) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    await this.autoWireTrustForDeliveryConfirmed({
      transactionId: updated.id,
      travelerId: tx.travelerId,
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

  private async recordTrustEventIfMissing(input: {
    userId: string;
    kind: string;
    scoreDelta: number;
    reasonCode: string;
    reasonSummary?: string;
    transactionId?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!this.trustService) {
      return;
    }

    await this.trustService.recordEventIfMissing(
      input.userId,
      {
        kind: input.kind as any,
        scoreDelta: input.scoreDelta,
        reasonCode: input.reasonCode,
        reasonSummary: input.reasonSummary,
        transactionId: input.transactionId,
        metadata: input.metadata,
      },
      { dedupeScope: 'TRANSACTION' },
    );
  }

  private async autoWireTrustForDisputeOpened(input: {
    transactionId: string;
    senderId: string;
    travelerId: string;
    initiatedBy: 'SENDER' | 'TRAVELER';
    openingSource: DisputeOpeningSource;
  }) {
    await this.recordTrustEventIfMissing({
      userId: input.senderId,
      kind: 'NEGATIVE_DISPUTE_OPENED',
      scoreDelta: -5,
      reasonCode: 'DISPUTE_OPENED',
      reasonSummary: 'A dispute was opened on this transaction',
      transactionId: input.transactionId,
      metadata: {
        initiatedBy: input.initiatedBy,
        openingSource: input.openingSource,
        participantSide: 'SENDER',
      },
    });

    await this.recordTrustEventIfMissing({
      userId: input.travelerId,
      kind: 'NEGATIVE_DISPUTE_OPENED',
      scoreDelta: -5,
      reasonCode: 'DISPUTE_OPENED',
      reasonSummary: 'A dispute was opened on this transaction',
      transactionId: input.transactionId,
      metadata: {
        initiatedBy: input.initiatedBy,
        openingSource: input.openingSource,
        participantSide: 'TRAVELER',
      },
    });
  }

  private async autoWireTrustForCancellation(input: {
    transactionId: string;
    userId: string;
    initiatedBy: 'SENDER' | 'TRAVELER';
  }) {
    await this.recordTrustEventIfMissing({
      userId: input.userId,
      kind:
        input.initiatedBy === 'SENDER'
          ? 'NEGATIVE_SENDER_CANCELLED_AFTER_PAYMENT'
          : 'NEGATIVE_TRAVELER_CANCELLED_AFTER_PAYMENT',
      scoreDelta: -10,
      reasonCode:
        input.initiatedBy === 'SENDER'
          ? 'SENDER_CANCELLED_AFTER_PAYMENT'
          : 'TRAVELER_CANCELLED_AFTER_PAYMENT',
      reasonSummary:
        input.initiatedBy === 'SENDER'
          ? 'Sender cancelled a paid transaction before departure'
          : 'Traveler cancelled a paid transaction before departure',
      transactionId: input.transactionId,
      metadata: { initiatedBy: input.initiatedBy },
    });
  }

  private async autoWireTrustForDeliveryConfirmed(input: {
    transactionId: string;
    travelerId: string;
  }) {
    await this.recordTrustEventIfMissing({
      userId: input.travelerId,
      kind: 'POSITIVE_DELIVERY_CONFIRMED',
      scoreDelta: 10,
      reasonCode: 'DELIVERY_CONFIRMED',
      reasonSummary: 'Delivery was successfully confirmed',
      transactionId: input.transactionId,
      metadata: { participantSide: 'TRAVELER' },
    });
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

    const paymentConfirmedAt =
      paymentStatus === PaymentStatus.SUCCESS ? new Date() : null;

    let payinRouting: {
      payinRailProvider: PaymentRailProvider | null;
      payinMethodType: PaymentMethodType | null;
      corridorCode: string | null;
    } | null = null;

    if (paymentStatus === PaymentStatus.SUCCESS) {
      await this.assertTravelerVerifiedForPaymentSuccess(tx.travelerId);

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

      payinRouting = await this.resolvePayinRoutingForCorridor(tx.corridorId);
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
        payinRailProvider:
          paymentStatus === PaymentStatus.SUCCESS
            ? payinRouting?.payinRailProvider ?? null
            : tx.payinRailProvider,
        payinMethodType:
          paymentStatus === PaymentStatus.SUCCESS
            ? payinRouting?.payinMethodType ?? null
            : tx.payinMethodType,
        payinProviderReference:
          paymentStatus === PaymentStatus.SUCCESS
            ? `payin:${id}`
            : tx.payinProviderReference,
        paymentConfirmedAt:
          paymentStatus === PaymentStatus.SUCCESS
            ? paymentConfirmedAt
            : tx.paymentConfirmedAt,
        paymentMetadata:
          paymentStatus === PaymentStatus.SUCCESS
            ? ({
                source: 'transaction.markPayment',
                routingResolvedAt: paymentConfirmedAt?.toISOString() ?? null,
                corridorCode: payinRouting?.corridorCode ?? null,
                payinRailProvider: payinRouting?.payinRailProvider ?? null,
                payinMethodType: payinRouting?.payinMethodType ?? null,
              } as any)
            : tx.paymentMetadata,
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