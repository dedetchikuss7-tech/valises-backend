import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  AmlDecisionAction,
  BehaviorRestrictionKind,
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
  LegalAcceptanceContext,
  LegalDocumentType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AmlService } from '../aml/aml.service';

type RestrictionAction =
  | 'PACKAGE_PUBLISH'
  | 'TRANSACTION_CREATE'
  | 'TRANSACTION_PAYMENT_SUCCESS'
  | 'MESSAGING';

type RestrictionCheckInput = {
  userId: string;
  action: RestrictionAction;
  allowedScopes: BehaviorRestrictionScope[];
  blockingKinds: BehaviorRestrictionKind[];
  metadata?: Record<string, unknown>;
};

export type EnforcementPort = {
  assertPackagePublishAllowed(input: {
    userId: string;
    packageId: string;
  }): Promise<void>;
  assertTransactionCreateAllowed(input: {
    senderId: string;
    travelerId: string;
    tripId?: string;
    packageId?: string;
  }): Promise<void>;
  assertTransactionPaymentSuccessAllowed(input: {
    transactionId: string;
    senderId: string;
    travelerId: string;
  }): Promise<void>;
  assertMessagingAllowed(input: {
    userId: string;
    role: string;
    transactionId: string;
  }): Promise<void>;
};

export const noopEnforcementService = {
  assertPackagePublishAllowed: async () => undefined,
  assertTransactionCreateAllowed: async () => undefined,
  assertTransactionPaymentSuccessAllowed: async () => undefined,
  assertMessagingAllowed: async () => undefined,
} as unknown as EnforcementService;

@Injectable()
export class EnforcementService implements EnforcementPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly amlService: AmlService,
  ) {}

  async assertPackagePublishAllowed(input: {
    userId: string;
    packageId: string;
  }) {
    await this.assertNoBlockingRestriction({
      userId: input.userId,
      action: 'PACKAGE_PUBLISH',
      allowedScopes: [
        BehaviorRestrictionScope.GLOBAL,
        BehaviorRestrictionScope.PACKAGES,
      ],
      blockingKinds: [
        BehaviorRestrictionKind.BLOCK_ACCOUNT,
        BehaviorRestrictionKind.BLOCK_PUBLISHING,
      ],
      metadata: {
        packageId: input.packageId,
      },
    });

    await this.assertPackageRulesAcceptance(input.userId, input.packageId);
  }

  async assertTransactionCreateAllowed(input: {
    senderId: string;
    travelerId: string;
    tripId?: string;
    packageId?: string;
  }) {
    await this.assertNoBlockingRestriction({
      userId: input.senderId,
      action: 'TRANSACTION_CREATE',
      allowedScopes: [
        BehaviorRestrictionScope.GLOBAL,
        BehaviorRestrictionScope.TRANSACTIONS,
      ],
      blockingKinds: [
        BehaviorRestrictionKind.BLOCK_ACCOUNT,
        BehaviorRestrictionKind.LIMIT_TRANSACTIONS,
      ],
      metadata: {
        side: 'SENDER',
        tripId: input.tripId ?? null,
        packageId: input.packageId ?? null,
      },
    });

    await this.assertNoBlockingRestriction({
      userId: input.travelerId,
      action: 'TRANSACTION_CREATE',
      allowedScopes: [
        BehaviorRestrictionScope.GLOBAL,
        BehaviorRestrictionScope.TRANSACTIONS,
      ],
      blockingKinds: [
        BehaviorRestrictionKind.BLOCK_ACCOUNT,
        BehaviorRestrictionKind.LIMIT_TRANSACTIONS,
      ],
      metadata: {
        side: 'TRAVELER',
        tripId: input.tripId ?? null,
        packageId: input.packageId ?? null,
      },
    });
  }

  async assertTransactionPaymentSuccessAllowed(input: {
    transactionId: string;
    senderId: string;
    travelerId: string;
  }) {
    await this.assertNoBlockingRestriction({
      userId: input.senderId,
      action: 'TRANSACTION_PAYMENT_SUCCESS',
      allowedScopes: [
        BehaviorRestrictionScope.GLOBAL,
        BehaviorRestrictionScope.TRANSACTIONS,
      ],
      blockingKinds: [
        BehaviorRestrictionKind.BLOCK_ACCOUNT,
        BehaviorRestrictionKind.LIMIT_TRANSACTIONS,
      ],
      metadata: {
        side: 'SENDER',
        transactionId: input.transactionId,
      },
    });

    await this.assertNoBlockingRestriction({
      userId: input.travelerId,
      action: 'TRANSACTION_PAYMENT_SUCCESS',
      allowedScopes: [
        BehaviorRestrictionScope.GLOBAL,
        BehaviorRestrictionScope.TRANSACTIONS,
      ],
      blockingKinds: [
        BehaviorRestrictionKind.BLOCK_ACCOUNT,
        BehaviorRestrictionKind.LIMIT_TRANSACTIONS,
      ],
      metadata: {
        side: 'TRAVELER',
        transactionId: input.transactionId,
      },
    });

    const amlResult = await this.amlService.evaluateTransaction(
      input.transactionId,
    );

    if (amlResult.allowed) {
      return;
    }

    const commonPayload = {
      transactionId: input.transactionId,
      amlCaseId: amlResult.amlCase?.id ?? null,
      riskLevel: amlResult.riskLevel,
      recommendedAction: amlResult.recommendedAction,
      signalCodes: amlResult.signalCodes,
      signalCount: amlResult.signalCount,
      reasonSummary: amlResult.reasonSummary,
    };

    if (amlResult.recommendedAction === AmlDecisionAction.BLOCK) {
      throw new ForbiddenException({
        code: 'AML_BLOCKED',
        message:
          'Payment confirmation is blocked because the transaction triggered blocking AML signals.',
        requiredFor: 'TRANSACTION_PAYMENT_SUCCESS',
        nextStep: 'ADMIN_REVIEW',
        nextStepUrl: `/aml/cases/${amlResult.amlCase?.id ?? ''}`,
        ...commonPayload,
      });
    }

    throw new BadRequestException({
      code: 'AML_REVIEW_REQUIRED',
      message:
        'Payment confirmation requires manual AML review before it can proceed.',
      requiredFor: 'TRANSACTION_PAYMENT_SUCCESS',
      nextStep: 'ADMIN_REVIEW',
      nextStepUrl: `/aml/cases/${amlResult.amlCase?.id ?? ''}`,
      ...commonPayload,
    });
  }

  async assertMessagingAllowed(input: {
    userId: string;
    role: string;
    transactionId: string;
  }) {
    if (input.role === 'ADMIN') {
      return;
    }

    await this.assertNoBlockingRestriction({
      userId: input.userId,
      action: 'MESSAGING',
      allowedScopes: [
        BehaviorRestrictionScope.GLOBAL,
        BehaviorRestrictionScope.MESSAGING,
      ],
      blockingKinds: [
        BehaviorRestrictionKind.BLOCK_ACCOUNT,
        BehaviorRestrictionKind.BLOCK_MESSAGING,
      ],
      metadata: {
        transactionId: input.transactionId,
      },
    });
  }

  private async assertPackageRulesAcceptance(userId: string, packageId: string) {
    const acceptance = await this.prisma.legalAcceptance.findFirst({
      where: {
        userId,
        documentType: LegalDocumentType.PROHIBITED_ITEMS_NOTICE,
        context: LegalAcceptanceContext.PACKAGE,
        packageId,
      },
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
      },
    });

    if (acceptance) {
      return;
    }

    throw new BadRequestException({
      code: 'LEGAL_ACCEPTANCE_REQUIRED',
      message:
        'Package rules acknowledgment is required before a package can be published.',
      requiredFor: 'PACKAGE_PUBLISH',
      userId,
      documentType: LegalDocumentType.PROHIBITED_ITEMS_NOTICE,
      context: LegalAcceptanceContext.PACKAGE,
      packageId,
      nextStep: 'LEGAL_ACKNOWLEDGMENT',
      nextStepUrl: `/legal/packages/${packageId}/acknowledge-rules`,
    });
  }

  private async assertNoBlockingRestriction(input: RestrictionCheckInput) {
    const now = new Date();

    const restriction = await this.prisma.behaviorRestriction.findFirst({
      where: {
        userId: input.userId,
        status: BehaviorRestrictionStatus.ACTIVE,
        scope: { in: input.allowedScopes },
        kind: { in: input.blockingKinds },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ imposedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        kind: true,
        scope: true,
        reasonCode: true,
        reasonSummary: true,
        expiresAt: true,
      },
    });

    if (!restriction) {
      return;
    }

    throw new ForbiddenException({
      code: 'CAPABILITY_RESTRICTED',
      message:
        'This action is currently blocked because an active behavior restriction applies to this user.',
      action: input.action,
      userId: input.userId,
      restrictionId: restriction.id,
      restrictionKind: restriction.kind,
      restrictionScope: restriction.scope,
      reasonCode: restriction.reasonCode,
      reasonSummary: restriction.reasonSummary,
      expiresAt: restriction.expiresAt,
      metadata: input.metadata ?? null,
    });
  }
}

