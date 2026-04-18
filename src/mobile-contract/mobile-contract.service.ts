import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BehaviorRestrictionScope,
  BehaviorRestrictionStatus,
  KycStatus,
  LegalAcceptanceContext,
  LegalDocumentType,
  TrustProfileStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MobileContractService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyContract(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        kycStatus: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const trustProfile = await this.prisma.userTrustProfile.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        score: 100,
        status: TrustProfileStatus.NORMAL,
        totalEvents: 0,
        positiveEvents: 0,
        negativeEvents: 0,
        activeRestrictionCount: 0,
      },
    });

    const activeRestrictions = await this.prisma.behaviorRestriction.findMany({
      where: {
        userId,
        status: BehaviorRestrictionStatus.ACTIVE,
      },
      orderBy: [{ imposedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const globalAcceptances = await this.prisma.legalAcceptance.findMany({
      where: {
        userId,
        context: LegalAcceptanceContext.GLOBAL,
      },
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const acceptedGlobalDocumentKeys = Array.from(
      new Set(
        globalAcceptances.map(
          (item) => `${item.documentType}:${item.documentVersion}`,
        ),
      ),
    );

    const legal = {
      hasAcceptedTermsOfService: globalAcceptances.some(
        (item) => item.documentType === LegalDocumentType.TERMS_OF_SERVICE,
      ),
      hasAcceptedPrivacyNotice: globalAcceptances.some(
        (item) => item.documentType === LegalDocumentType.PRIVACY_NOTICE,
      ),
      hasAcceptedEscrowNotice: globalAcceptances.some(
        (item) => item.documentType === LegalDocumentType.ESCROW_NOTICE,
      ),
      acceptedGlobalDocumentKeys,
    };

    const capabilities = this.buildCapabilities(activeRestrictions);

    return {
      contractVersion: 'v1',
      generatedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      kyc: {
        status: user.kycStatus,
        isVerified: user.kycStatus === KycStatus.VERIFIED,
        nextStep: user.kycStatus === KycStatus.VERIFIED ? null : 'KYC',
        nextStepUrl: user.kycStatus === KycStatus.VERIFIED ? null : '/kyc',
      },
      trustProfile: {
        score: trustProfile.score,
        status: trustProfile.status,
        totalEvents: trustProfile.totalEvents,
        positiveEvents: trustProfile.positiveEvents,
        negativeEvents: trustProfile.negativeEvents,
        activeRestrictionCount: trustProfile.activeRestrictionCount,
        lastEventAt: trustProfile.lastEventAt,
      },
      activeRestrictions: activeRestrictions.map((item) => ({
        id: item.id,
        kind: item.kind,
        scope: item.scope,
        reasonCode: item.reasonCode,
        reasonSummary: item.reasonSummary ?? null,
        expiresAt: item.expiresAt ?? null,
        imposedAt: item.imposedAt,
      })),
      capabilities,
      legal,
    };
  }

  private buildCapabilities(activeRestrictions: any[]) {
    const hasBlockAccount = activeRestrictions.some(
      (item) => item.kind === 'BLOCK_ACCOUNT',
    );

    const blocksPublishingGlobally = activeRestrictions.some(
      (item) =>
        item.kind === 'BLOCK_PUBLISHING' &&
        item.scope === BehaviorRestrictionScope.GLOBAL,
    );

    const blocksTripsPublishing = activeRestrictions.some(
      (item) =>
        item.kind === 'BLOCK_PUBLISHING' &&
        item.scope === BehaviorRestrictionScope.TRIPS,
    );

    const blocksPackagesPublishing = activeRestrictions.some(
      (item) =>
        item.kind === 'BLOCK_PUBLISHING' &&
        item.scope === BehaviorRestrictionScope.PACKAGES,
    );

    const blocksMessagingGlobally = activeRestrictions.some(
      (item) =>
        item.kind === 'BLOCK_MESSAGING' &&
        item.scope === BehaviorRestrictionScope.GLOBAL,
    );

    const blocksMessagingScoped = activeRestrictions.some(
      (item) =>
        item.kind === 'BLOCK_MESSAGING' &&
        item.scope === BehaviorRestrictionScope.MESSAGING,
    );

    const limitsTransactionsGlobally = activeRestrictions.some(
      (item) =>
        item.kind === 'LIMIT_TRANSACTIONS' &&
        item.scope === BehaviorRestrictionScope.GLOBAL,
    );

    const limitsTransactionsScoped = activeRestrictions.some(
      (item) =>
        item.kind === 'LIMIT_TRANSACTIONS' &&
        item.scope === BehaviorRestrictionScope.TRANSACTIONS,
    );

    return {
      canPublishTrips:
        !hasBlockAccount &&
        !blocksPublishingGlobally &&
        !blocksTripsPublishing,
      canPublishPackages:
        !hasBlockAccount &&
        !blocksPublishingGlobally &&
        !blocksPackagesPublishing,
      canMessage:
        !hasBlockAccount &&
        !blocksMessagingGlobally &&
        !blocksMessagingScoped,
      canCreateTransactions:
        !hasBlockAccount &&
        !limitsTransactionsGlobally &&
        !limitsTransactionsScoped,
    };
  }
}