import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AmlCaseStatus,
  AmlDecisionAction,
  AmlRiskLevel,
  PackageContentComplianceStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListAmlCasesQueryDto } from './dto/list-aml-cases-query.dto';
import { ResolveAmlCaseDto } from './dto/resolve-aml-case.dto';

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

  constructor(private readonly prisma: PrismaService) {}

  async listCases(query: ListAmlCasesQueryDto) {
    return this.prisma.amlCase.findMany({
      where: {
        status: query.status,
        currentAction: query.currentAction,
        riskLevel: query.riskLevel,
        transactionId: query.transactionId,
      },
      orderBy: [{ openedAt: 'desc' }, { createdAt: 'desc' }],
      take: query.limit ?? 50,
    });
  }

  async getCase(id: string) {
    const amlCase = await this.prisma.amlCase.findUnique({
      where: { id },
    });

    if (!amlCase) {
      throw new NotFoundException('AML case not found');
    }

    return amlCase;
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
            signalCodes: evaluation.signalCodes as unknown as Prisma.InputJsonValue,
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
            signalCodes: evaluation.signalCodes as unknown as Prisma.InputJsonValue,
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
    const amlCase = await this.prisma.amlCase.findUnique({
      where: { id },
    });

    if (!amlCase) {
      throw new NotFoundException('AML case not found');
    }

    return this.prisma.amlCase.update({
      where: { id },
      data: {
        currentAction: dto.action as AmlDecisionAction,
        status: AmlCaseStatus.RESOLVED,
        reviewedById,
        reviewNotes: dto.notes ?? null,
        resolvedAt: new Date(),
      },
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

    if (
      input.currency === 'XAF' &&
      input.amount >= AmlService.HIGH_AMOUNT_XAF
    ) {
      signalCodes.push('LARGE_XAF_AMOUNT');
    }

    if (
      input.currency === 'XAF' &&
      input.declaredValueAmount !== null &&
      input.declaredValueAmount >= AmlService.HIGH_DECLARED_VALUE_XAF
    ) {
      signalCodes.push('HIGH_DECLARED_VALUE_XAF');
    }

    if (input.containsValuableItems) {
      signalCodes.push('VALUABLE_ITEMS_DECLARED');
    }

    if (input.containsBattery) {
      signalCodes.push('BATTERY_CONTENT_DECLARED');
    }

    if (input.containsMedicine) {
      signalCodes.push('MEDICINE_CONTENT_DECLARED');
    }

    if (
      input.containsElectronic &&
      ((input.currency === 'XAF' &&
        input.amount >= AmlService.ELECTRONICS_REVIEW_AMOUNT_XAF) ||
        (input.currency === 'XAF' &&
          input.declaredValueAmount !== null &&
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

    const hasHighReviewSignal = signalCodes.some((code) =>
      highReviewSignals.includes(code),
    );

    if (hasHighReviewSignal) {
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