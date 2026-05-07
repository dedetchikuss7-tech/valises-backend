import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  AmlCaseStatus,
  AmlDecisionAction,
  AmlRiskLevel,
  BehaviorRestrictionKind,
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
  PackageContentComplianceStatus,
  Prisma,
  TrustProfileStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import { AmlCaseResponseDto } from './dto/aml-case-response.dto';
import {
  AmlCasesSortBy,
  ListAmlCasesQueryDto,
  SortOrder,
} from './dto/list-aml-cases-query.dto';
import { ResolveAmlCaseDto } from './dto/resolve-aml-case.dto';
import { TrustService } from '../trust/trust.service';

type AmlEvaluationResult = {
  riskLevel: AmlRiskLevel;
  recommendedAction: AmlDecisionAction;
  signalCodes: string[];
  reasonSummary: string | null;
};

@Injectable()
export class AmlService {
  private static readonly HIGH_AMOUNT_XAF = 1_000_000;
  private static readonly HIGH_DECLARED_VALUE_XAF = 500_000;
  private static readonly ELECTRONICS_REVIEW_AMOUNT_XAF = 500_000;
  private static readonly MANY_ITEMS_THRESHOLD = 10;
  private static readonly TRUST_UNDER_REVIEW_THRESHOLD = 70;

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly trustService?: TrustService,
  ) {}

  async listCases(
    query: ListAmlCasesQueryDto,
  ): Promise<PaginatedListResponseDto<AmlCaseResponseDto>> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const where: Prisma.AmlCaseWhereInput = {
      status: query.status,
      currentAction: query.currentAction,
      riskLevel: query.riskLevel,
      transactionId: query.transactionId,
      ...(query.userId
        ? {
            OR: [{ senderId: query.userId }, { travelerId: query.userId }],
          }
        : {}),
    };

    const rows = await this.prisma.amlCase.findMany({
      where,
      orderBy: [{ openedAt: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });

    let items = await this.mapAmlCases(rows);

    if (query.requiresAction !== undefined) {
      items = items.filter(
        (item) => item.requiresAction === query.requiresAction,
      );
    }

    if (query.q) {
      const needle = query.q.trim().toLowerCase();
      items = items.filter((item) => {
        const haystack = [
          item.id,
          item.transactionId,
          item.senderId,
          item.travelerId,
          item.packageId ?? '',
          item.riskLevel,
          item.recommendedAction,
          item.currentAction,
          item.status,
          item.reasonSummary ?? '',
          item.reviewedById ?? '',
          item.reviewNotes ?? '',
          ...item.signalCodes,
          ...item.restrictionReasonCodes,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(needle);
      });
    }

    this.sortAmlCases(items, query.sortBy, query.sortOrder);

    const total = items.length;
    const pagedItems = items.slice(offset, offset + limit);

    return {
      items: pagedItems,
      total,
      limit,
      offset,
      hasMore: offset + pagedItems.length < total,
    };
  }

  async getCase(id: string): Promise<AmlCaseResponseDto> {
    const amlCase = await this.prisma.amlCase.findUnique({
      where: { id },
    });

    if (!amlCase) {
      throw new NotFoundException('AML case not found');
    }

    const [mapped] = await this.mapAmlCases([amlCase]);
    return mapped;
  }

  async evaluateTransaction(transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        senderId: true,
        travelerId: true,
        packageId: true,
        amount: true,
        currency: true,
        package: {
          select: {
            id: true,
            declaredValueAmount: true,
            declaredItemCount: true,
            containsProhibitedItems: true,
            containsValuableItems: true,
            containsBattery: true,
            containsMedicine: true,
            containsElectronic: true,
            contentComplianceStatus: true,
          },
        },
        amlCase: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (!transaction.package) {
      throw new BadRequestException(
        'AML evaluation requires a transaction linked to a package',
      );
    }

    const evaluation = this.buildEvaluation({
      amount: transaction.amount,
      currency: transaction.currency,
      declaredValueAmount:
        transaction.package.declaredValueAmount !== null &&
        transaction.package.declaredValueAmount !== undefined
          ? Number(transaction.package.declaredValueAmount)
          : null,
      declaredItemCount: transaction.package.declaredItemCount ?? null,
      containsProhibitedItems: transaction.package.containsProhibitedItems,
      containsValuableItems: transaction.package.containsValuableItems,
      containsBattery: transaction.package.containsBattery,
      containsMedicine: transaction.package.containsMedicine,
      containsElectronic: transaction.package.containsElectronic,
      contentComplianceStatus: transaction.package.contentComplianceStatus,
    });

    if (evaluation.recommendedAction === AmlDecisionAction.ALLOW) {
      await this.releaseAmlRestrictionsForTransaction({
        transactionId: transaction.id,
        senderId: transaction.senderId,
        travelerId: transaction.travelerId,
        reviewedById: null,
      });

      return {
        transactionId: transaction.id,
        allowed: true,
        riskLevel: evaluation.riskLevel,
        recommendedAction: evaluation.recommendedAction,
        signalCodes: evaluation.signalCodes,
        signalCount: evaluation.signalCodes.length,
        reasonSummary: evaluation.reasonSummary,
        caseCreated: false,
        amlCase: transaction.amlCase ?? null,
      };
    }

    const now = new Date();

    const amlCase = transaction.amlCase
      ? await this.prisma.amlCase.update({
          where: { id: transaction.amlCase.id },
          data: {
            riskLevel: evaluation.riskLevel,
            recommendedAction: evaluation.recommendedAction,
            currentAction: evaluation.recommendedAction,
            status: AmlCaseStatus.OPEN,
            signalCodes:
              evaluation.signalCodes as unknown as Prisma.InputJsonValue,
            signalCount: evaluation.signalCodes.length,
            reasonSummary: evaluation.reasonSummary,
            reviewedById: null,
            reviewNotes: null,
            resolvedAt: null,
            metadata: {
              lastEvaluatedAt: now.toISOString(),
              currency: transaction.currency,
              amount: transaction.amount,
            } as Prisma.InputJsonValue,
          },
        })
      : await this.prisma.amlCase.create({
          data: {
            transactionId: transaction.id,
            senderId: transaction.senderId,
            travelerId: transaction.travelerId,
            packageId: transaction.packageId ?? null,
            riskLevel: evaluation.riskLevel,
            recommendedAction: evaluation.recommendedAction,
            currentAction: evaluation.recommendedAction,
            status: AmlCaseStatus.OPEN,
            signalCodes:
              evaluation.signalCodes as unknown as Prisma.InputJsonValue,
            signalCount: evaluation.signalCodes.length,
            reasonSummary: evaluation.reasonSummary,
            openedAt: now,
            metadata: {
              firstEvaluatedAt: now.toISOString(),
              currency: transaction.currency,
              amount: transaction.amount,
            } as Prisma.InputJsonValue,
          },
        });

    await this.autoWireTrustFromAml(transaction, amlCase, evaluation);
    await this.syncGraduatedRestrictionsForAmlCase({
      amlCase,
      action: evaluation.recommendedAction,
      reviewedById: null,
    });

    return {
      transactionId: transaction.id,
      allowed: false,
      riskLevel: evaluation.riskLevel,
      recommendedAction: evaluation.recommendedAction,
      signalCodes: evaluation.signalCodes,
      signalCount: evaluation.signalCodes.length,
      reasonSummary: evaluation.reasonSummary,
      caseCreated: true,
      amlCase,
    };
  }

  async resolveCase(id: string, dto: ResolveAmlCaseDto, reviewedById: string) {
    const existing = await this.prisma.amlCase.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('AML case not found');
    }

    const updated = await this.prisma.amlCase.update({
      where: { id },
      data: {
        currentAction: dto.action,
        status: AmlCaseStatus.RESOLVED,
        reviewedById,
        reviewNotes: dto.notes ?? null,
        resolvedAt: new Date(),
      },
    });

    await this.syncGraduatedRestrictionsForAmlCase({
      amlCase: updated,
      action: dto.action as AmlDecisionAction,
      reviewedById,
    });

    return updated;
  }

  private sortAmlCases(
    items: AmlCaseResponseDto[],
    sortBy = AmlCasesSortBy.OPENED_AT,
    sortOrder = SortOrder.DESC,
  ) {
    const riskRank: Record<AmlRiskLevel, number> = {
      [AmlRiskLevel.LOW]: 1,
      [AmlRiskLevel.MEDIUM]: 2,
      [AmlRiskLevel.HIGH]: 3,
      [AmlRiskLevel.CRITICAL]: 4,
    };

    items.sort((a, b) => {
      let compare = 0;

      switch (sortBy) {
        case AmlCasesSortBy.CREATED_AT:
          compare = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case AmlCasesSortBy.UPDATED_AT:
          compare = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case AmlCasesSortBy.RISK_LEVEL:
          compare = riskRank[a.riskLevel] - riskRank[b.riskLevel];
          break;
        case AmlCasesSortBy.CURRENT_ACTION:
          compare = a.currentAction.localeCompare(b.currentAction);
          break;
        case AmlCasesSortBy.SIGNAL_COUNT:
          compare = a.signalCount - b.signalCount;
          break;
        case AmlCasesSortBy.OPENED_AT:
        default:
          compare = a.openedAt.getTime() - b.openedAt.getTime();
      }

      return sortOrder === SortOrder.ASC ? compare : -compare;
    });
  }

  private async mapAmlCases(rows: any[]): Promise<AmlCaseResponseDto[]> {
    if (rows.length === 0) {
      return [];
    }

    const reasonCodes = rows.flatMap((row) => [
      this.buildRestrictionReasonCode(
        AmlDecisionAction.REQUIRE_REVIEW,
        row.transactionId,
      ),
      this.buildRestrictionReasonCode(AmlDecisionAction.BLOCK, row.transactionId),
    ]);

    const restrictions =
      typeof (this.prisma as any).behaviorRestriction?.findMany === 'function'
        ? await this.prisma.behaviorRestriction.findMany({
            where: {
              status: BehaviorRestrictionStatus.ACTIVE,
              reasonCode: { in: reasonCodes },
            },
            select: {
              userId: true,
              reasonCode: true,
            },
          })
        : [];

    return rows.map((row) => {
      const signalCodes = this.parseSignalCodes(row.signalCodes);
      const restrictionReasonCodes = restrictions
        .filter(
          (restriction: { userId: string; reasonCode: string }) =>
            (restriction.userId === row.senderId ||
              restriction.userId === row.travelerId) &&
            reasonCodes.includes(restriction.reasonCode),
        )
        .map((restriction: { reasonCode: string }) => restriction.reasonCode);

      return {
        id: row.id,
        transactionId: row.transactionId,
        senderId: row.senderId,
        travelerId: row.travelerId,
        packageId: row.packageId ?? null,
        riskLevel: row.riskLevel,
        recommendedAction: row.recommendedAction,
        currentAction: row.currentAction,
        status: row.status,
        signalCodes,
        signalCount: row.signalCount ?? signalCodes.length,
        reasonSummary: row.reasonSummary ?? null,
        reviewedById: row.reviewedById ?? null,
        reviewNotes: row.reviewNotes ?? null,
        openedAt: row.openedAt,
        resolvedAt: row.resolvedAt ?? null,
        metadata:
          row.metadata &&
          typeof row.metadata === 'object' &&
          !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : null,
        isOpen: row.status === AmlCaseStatus.OPEN,
        requiresAction:
          row.status === AmlCaseStatus.OPEN &&
          row.currentAction !== AmlDecisionAction.ALLOW,
        activeRestrictionCount: restrictionReasonCodes.length,
        restrictionReasonCodes,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  }

  private parseSignalCodes(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private async autoWireTrustFromAml(
    transaction: {
      id: string;
      senderId: string;
      travelerId: string;
    },
    amlCase: { id: string; currentAction: AmlDecisionAction },
    evaluation: AmlEvaluationResult,
  ) {
    if (!this.trustService) return;

    const isBlock = evaluation.recommendedAction === AmlDecisionAction.BLOCK;
    const kind = isBlock ? 'NEGATIVE_AML_BLOCK' : 'NEGATIVE_AML_REVIEW';
    const scoreDelta = isBlock ? -20 : -10;
    const reasonCode = isBlock ? 'AML_BLOCK' : 'AML_REVIEW_REQUIRED';

    const metadata = {
      amlCaseId: amlCase.id,
      signalCodes: evaluation.signalCodes,
      riskLevel: evaluation.riskLevel,
      recommendedAction: evaluation.recommendedAction,
    };

    await this.trustService.recordEventIfMissing(
      transaction.senderId,
      {
        kind: kind as any,
        scoreDelta,
        reasonCode,
        reasonSummary: evaluation.reasonSummary ?? undefined,
        transactionId: transaction.id,
        metadata,
      },
      { dedupeScope: 'TRANSACTION' },
    );

    await this.trustService.recordEventIfMissing(
      transaction.travelerId,
      {
        kind: kind as any,
        scoreDelta,
        reasonCode,
        reasonSummary: evaluation.reasonSummary ?? undefined,
        transactionId: transaction.id,
        metadata,
      },
      { dedupeScope: 'TRANSACTION' },
    );
  }

  private buildRestrictionReasonCode(
    action: AmlDecisionAction,
    transactionId: string,
  ) {
    if (action === AmlDecisionAction.BLOCK) {
      return `AML_BLOCK:${transactionId}`;
    }

    return `AML_REVIEW_REQUIRED:${transactionId}`;
  }

  private buildRestrictionConfig(action: AmlDecisionAction) {
    if (action === AmlDecisionAction.BLOCK) {
      return {
        kind: BehaviorRestrictionKind.LIMIT_TRANSACTIONS,
        scope: BehaviorRestrictionScope.TRANSACTIONS,
        reasonSummary:
          'Transactions are temporarily restricted because AML blocking signals were triggered.',
      };
    }

    return {
      kind: BehaviorRestrictionKind.WARNING_ONLY,
      scope: BehaviorRestrictionScope.TRANSACTIONS,
      reasonSummary: 'Transaction activity is flagged for manual AML review.',
    };
  }

  private async ensureTrustProfile(userId: string) {
    const existing = await this.prisma.userTrustProfile.findUnique({
      where: { userId },
    });

    if (existing) return existing;

    return this.prisma.userTrustProfile.create({
      data: {
        userId,
        score: 100,
        status: TrustProfileStatus.NORMAL,
        totalEvents: 0,
        positiveEvents: 0,
        negativeEvents: 0,
        activeRestrictionCount: 0,
      },
    });
  }

  private deriveTrustProfileStatus(
    score: number,
    activeRestrictionCount: number,
  ) {
    if (activeRestrictionCount > 0) return TrustProfileStatus.RESTRICTED;

    if (score < AmlService.TRUST_UNDER_REVIEW_THRESHOLD) {
      return TrustProfileStatus.UNDER_REVIEW;
    }

    return TrustProfileStatus.NORMAL;
  }

  private async refreshRestrictionDrivenProfile(userId: string) {
    const profile = await this.ensureTrustProfile(userId);

    const activeRestrictionCount = await this.prisma.behaviorRestriction.count({
      where: {
        userId,
        status: BehaviorRestrictionStatus.ACTIVE,
      },
    });

    return this.prisma.userTrustProfile.update({
      where: { userId },
      data: {
        activeRestrictionCount,
        status: this.deriveTrustProfileStatus(
          profile.score,
          activeRestrictionCount,
        ),
      },
    });
  }

  private async ensureGraduatedRestriction(input: {
    userId: string;
    action: AmlDecisionAction;
    transactionId: string;
    amlCaseId: string;
    riskLevel: AmlRiskLevel;
    signalCodes: string[];
  }) {
    if (input.action === AmlDecisionAction.ALLOW) return;

    const config = this.buildRestrictionConfig(input.action);
    const reasonCode = this.buildRestrictionReasonCode(
      input.action,
      input.transactionId,
    );

    const existing = await this.prisma.behaviorRestriction.findFirst({
      where: {
        userId: input.userId,
        status: BehaviorRestrictionStatus.ACTIVE,
        kind: config.kind,
        scope: config.scope,
        reasonCode,
      },
      select: { id: true },
    });

    if (!existing) {
      await this.prisma.behaviorRestriction.create({
        data: {
          userId: input.userId,
          kind: config.kind,
          scope: config.scope,
          status: BehaviorRestrictionStatus.ACTIVE,
          reasonCode,
          reasonSummary: config.reasonSummary,
          imposedById: null,
          metadata: {
            source: 'aml.auto_graduated_action',
            amlCaseId: input.amlCaseId,
            transactionId: input.transactionId,
            riskLevel: input.riskLevel,
            signalCodes: input.signalCodes,
            action: input.action,
          } as Prisma.InputJsonValue,
        },
      });
    }

    await this.refreshRestrictionDrivenProfile(input.userId);
  }

  private async releaseRestrictionsByReasonCode(input: {
    userId: string;
    reasonCodes: string[];
    releasedById: string | null;
  }) {
    const restrictions = await this.prisma.behaviorRestriction.findMany({
      where: {
        userId: input.userId,
        status: BehaviorRestrictionStatus.ACTIVE,
        reasonCode: { in: input.reasonCodes },
      },
      select: { id: true },
    });

    for (const restriction of restrictions) {
      await this.prisma.behaviorRestriction.update({
        where: { id: restriction.id },
        data: {
          status: BehaviorRestrictionStatus.RELEASED,
          releasedAt: new Date(),
          releasedById: input.releasedById,
        },
      });
    }

    await this.refreshRestrictionDrivenProfile(input.userId);
  }

  private async releaseAmlRestrictionsForTransaction(input: {
    transactionId: string;
    senderId: string;
    travelerId: string;
    reviewedById: string | null;
  }) {
    const reasonCodes = [
      this.buildRestrictionReasonCode(
        AmlDecisionAction.REQUIRE_REVIEW,
        input.transactionId,
      ),
      this.buildRestrictionReasonCode(AmlDecisionAction.BLOCK, input.transactionId),
    ];

    await this.releaseRestrictionsByReasonCode({
      userId: input.senderId,
      reasonCodes,
      releasedById: input.reviewedById,
    });

    await this.releaseRestrictionsByReasonCode({
      userId: input.travelerId,
      reasonCodes,
      releasedById: input.reviewedById,
    });
  }

  private async syncGraduatedRestrictionsForAmlCase(input: {
    amlCase: {
      id: string;
      transactionId: string;
      senderId: string;
      travelerId: string;
      riskLevel: AmlRiskLevel;
      currentAction: AmlDecisionAction;
      signalCodes: unknown;
    };
    action: AmlDecisionAction;
    reviewedById: string | null;
  }) {
    await this.releaseAmlRestrictionsForTransaction({
      transactionId: input.amlCase.transactionId,
      senderId: input.amlCase.senderId,
      travelerId: input.amlCase.travelerId,
      reviewedById: input.reviewedById,
    });

    if (input.action === AmlDecisionAction.ALLOW) return;

    const signalCodes = this.parseSignalCodes(input.amlCase.signalCodes);

    await this.ensureGraduatedRestriction({
      userId: input.amlCase.senderId,
      action: input.action,
      transactionId: input.amlCase.transactionId,
      amlCaseId: input.amlCase.id,
      riskLevel: input.amlCase.riskLevel,
      signalCodes,
    });

    await this.ensureGraduatedRestriction({
      userId: input.amlCase.travelerId,
      action: input.action,
      transactionId: input.amlCase.transactionId,
      amlCaseId: input.amlCase.id,
      riskLevel: input.amlCase.riskLevel,
      signalCodes,
    });
  }

  private buildEvaluation(input: {
    amount: number;
    currency: string;
    declaredValueAmount: number | null;
    declaredItemCount: number | null;
    containsProhibitedItems: boolean;
    containsValuableItems: boolean;
    containsBattery: boolean;
    containsMedicine: boolean;
    containsElectronic: boolean;
    contentComplianceStatus: PackageContentComplianceStatus;
  }): AmlEvaluationResult {
    const signalCodes: string[] = [];

    if (
      input.containsProhibitedItems ||
      input.contentComplianceStatus === PackageContentComplianceStatus.BLOCKED
    ) {
      signalCodes.push('PROHIBITED_OR_BLOCKED_CONTENT');
    }

    if (input.currency === 'XAF' && input.amount >= AmlService.HIGH_AMOUNT_XAF) {
      signalCodes.push('LARGE_XAF_AMOUNT');
    }

    if (
      input.currency === 'XAF' &&
      input.declaredValueAmount !== null &&
      input.declaredValueAmount >= AmlService.HIGH_DECLARED_VALUE_XAF
    ) {
      signalCodes.push('HIGH_DECLARED_VALUE_XAF');
    }

    if (input.containsValuableItems) signalCodes.push('VALUABLE_ITEMS_DECLARED');
    if (input.containsBattery) signalCodes.push('BATTERY_CONTENT_DECLARED');
    if (input.containsMedicine) signalCodes.push('MEDICINE_CONTENT_DECLARED');

    if (
      input.containsElectronic &&
      input.currency === 'XAF' &&
      (input.amount >= AmlService.ELECTRONICS_REVIEW_AMOUNT_XAF ||
        (input.declaredValueAmount !== null &&
          input.declaredValueAmount >= 250_000))
    ) {
      signalCodes.push('ELECTRONICS_HIGH_VALUE_PATTERN');
    }

    if (
      input.declaredItemCount !== null &&
      input.declaredItemCount >= AmlService.MANY_ITEMS_THRESHOLD
    ) {
      signalCodes.push('MANY_DECLARED_ITEMS');
    }

    if (signalCodes.includes('PROHIBITED_OR_BLOCKED_CONTENT')) {
      return {
        riskLevel: AmlRiskLevel.CRITICAL,
        recommendedAction: AmlDecisionAction.BLOCK,
        signalCodes,
        reasonSummary:
          'Blocked or prohibited package content was detected by AML light screening.',
      };
    }

    const highReviewSignals = [
      'LARGE_XAF_AMOUNT',
      'HIGH_DECLARED_VALUE_XAF',
      'VALUABLE_ITEMS_DECLARED',
      'BATTERY_CONTENT_DECLARED',
      'MEDICINE_CONTENT_DECLARED',
      'ELECTRONICS_HIGH_VALUE_PATTERN',
    ];

    if (signalCodes.some((code) => highReviewSignals.includes(code))) {
      return {
        riskLevel: AmlRiskLevel.HIGH,
        recommendedAction: AmlDecisionAction.REQUIRE_REVIEW,
        signalCodes,
        reasonSummary:
          'Transaction triggered one or more AML light review signals and requires manual review.',
      };
    }

    if (signalCodes.length > 0) {
      return {
        riskLevel: AmlRiskLevel.MEDIUM,
        recommendedAction: AmlDecisionAction.REQUIRE_REVIEW,
        signalCodes,
        reasonSummary:
          'Transaction triggered AML light monitoring signals and should be reviewed.',
      };
    }

    return {
      riskLevel: AmlRiskLevel.LOW,
      recommendedAction: AmlDecisionAction.ALLOW,
      signalCodes,
      reasonSummary: null,
    };
  }
}