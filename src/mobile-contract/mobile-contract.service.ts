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

    const activeCorridors = await this.prisma.corridor.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, code: true, name: true, status: true },
      orderBy: { code: 'asc' },
    });

    return {
      contractVersion: 'v1',
      generatedAt: new Date().toISOString(),
      platformVersion: '1.0.0',
      maxTransactionAmountEUR: 2000,
      supportedPayinMethods: ['MOBILE_MONEY', 'CARD'],
      corridors: activeCorridors,
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

  getContractV2() {
    return {
      version: '2.0.0',
      generatedAt: new Date().toISOString(),
      baseUrl: process.env.API_BASE_URL ?? 'https://your-api.railway.app',

      auth: {
        endpoints: {
          register: { method: 'POST', path: '/auth/register' },
          login: { method: 'POST', path: '/auth/login' },
          refreshToken: { method: 'POST', path: '/auth/refresh' },
        },
      },

      users: {
        endpoints: {
          getMe: { method: 'GET', path: '/users/me' },
          updateMe: { method: 'PATCH', path: '/users/me' },
          getTrustProfile: { method: 'GET', path: '/users/me/trust-profile' },
          deleteMyData: { method: 'DELETE', path: '/me/data' },
        },
      },

      kyc: {
        endpoints: {
          submitKyc: { method: 'POST', path: '/kyc/submit' },
          getKycStatus: { method: 'GET', path: '/kyc/status' },
        },
      },

      trips: {
        note: 'carrierId = the traveler (not travelerId)',
        endpoints: {
          createTrip: { method: 'POST', path: '/trips' },
          listTrips: { method: 'GET', path: '/trips' },
          getTrip: { method: 'GET', path: '/trips/:id' },
        },
      },

      transactions: {
        statusFlow: ['CREATED', 'PAID', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'DISPUTED'],
        endpoints: {
          createTransaction: { method: 'POST', path: '/transactions' },
          getTransaction: { method: 'GET', path: '/transactions/:id' },
          listMyTransactions: { method: 'GET', path: '/transactions/me' },
          confirmDelivery: { method: 'POST', path: '/transactions/:id/confirm-delivery' },
          cancelTransaction: { method: 'POST', path: '/transactions/:id/cancel' },
        },
      },

      payments: {
        endpoints: {
          createPaymentIntent: { method: 'POST', path: '/payments/intent' },
          getPaymentStatus: { method: 'GET', path: '/payments/:transactionId/status' },
        },
      },

      disputes: {
        endpoints: {
          openDispute: { method: 'POST', path: '/disputes' },
          getDispute: { method: 'GET', path: '/disputes/:id' },
          submitEvidence: { method: 'POST', path: '/disputes/:id/evidence' },
        },
      },

      payouts: {
        autoEligibilityFlow: {
          description: 'Payout auto eligibility added in lot #286',
          criteria: [
            'Payout status PENDING',
            'deliveryConfirmedAt >= 48h ago',
            'User trustScore >= 85',
            'Zero active fraud flags',
          ],
          adminEndpoints: {
            eligibleQueue: { method: 'GET', path: '/admin/payout-auto/eligible-queue' },
            approve: { method: 'POST', path: '/admin/payout-auto/approve' },
          },
        },
        endpoints: {
          getMyPayouts: { method: 'GET', path: '/payouts/me' },
        },
      },

      protectionValises: {
        description: 'Compensation system for lost/damaged/delayed parcels. NOT insurance.',
        maxAmountXAF: 50000,
        claimWindowDays: 7,
        eligibleStatuses: ['DELIVERED', 'DISPUTED'],
        types: ['LOST', 'DAMAGED', 'DELAYED'],
        statuses: ['PENDING_REVIEW', 'UNDER_INVESTIGATION', 'APPROVED', 'REJECTED', 'PAID'],
        endpoints: {
          submitRequest: { method: 'POST', path: '/compensation/request' },
          getMyRequests: { method: 'GET', path: '/compensation/my-requests' },
        },
      },

      trustLevel: {
        description: 'Computed server-side on every request — never cached client-side',
        computationVersion: 'v1',
        levels: {
          EXPLORER: 'Default level — no KYC',
          VERIFIED: 'KYC verified',
          TRUSTED: 'VERIFIED + score >= 70 + >= 3 deliveries as traveler',
          HIGH_TRUST: 'TRUSTED + score >= 85 + >= 10 deliveries + 0 active fraud flags',
        },
        responseShape: {
          level: 'TrustLevel enum',
          score: 'number',
          signals: 'string[]',
          computationVersion: 'v1',
        },
        endpoints: {
          myTrustProfile: { method: 'GET', path: '/users/me/trust-profile' },
        },
      },

      notifications: {
        featureFlag: 'NOTIFICATIONS_ENABLED (default false)',
        events: [
          'TRANSACTION_CREATED',
          'PAYMENT_CONFIRMED',
          'DELIVERY_CONFIRMED',
          'DISPUTE_OPENED',
          'PAYOUT_PAID',
        ],
        idempotencyKeyFormat: 'notification:{eventType}:{entityId}',
        note: 'Real sending wired in future lot — currently logged only',
      },

      reviews: {
        endpoints: {
          submitReview: { method: 'POST', path: '/reviews' },
          getMyReviews: { method: 'GET', path: '/reviews/me' },
          getUserReviews: { method: 'GET', path: '/reviews/user/:id' },
          getTrustProfile: { method: 'GET', path: '/trust/profile/:userId' },
        },
      },

      matching: {
        endpoints: {
          getCandidates: { method: 'GET', path: '/matching/candidates/:transactionId' },
          getShortlist: { method: 'GET', path: '/matching/shortlist/:transactionId' },
        },
        responseFields: {
          matchScore: '0-100',
          travelerTrustBadges: 'string[]',
          isRecommended: 'boolean',
        },
      },

      referral: {
        endpoints: {
          getMyCode: { method: 'GET', path: '/referral/my-code' },
          applyCode: { method: 'POST', path: '/referral/apply' },
          getMyReferrals: { method: 'GET', path: '/referral/my-referrals' },
        },
      },

      storage: {
        endpoints: {
          getPresignedUploadUrl: { method: 'POST', path: '/storage/presigned-upload' },
          getPresignedDownloadUrl: { method: 'GET', path: '/storage/presigned-download/:key' },
        },
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        expirySeconds: 900,
      },

      enums: {
        TrustLevel: ['EXPLORER', 'VERIFIED', 'TRUSTED', 'HIGH_TRUST'],
        TransactionStatus: ['CREATED', 'PAID', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'DISPUTED'],
        PaymentStatus: ['PENDING', 'SUCCESS', 'FAILED'],
        PayoutStatus: ['PENDING', 'REQUESTED', 'PROCESSING', 'PAID', 'FAILED'],
        KycStatus: ['PENDING', 'VERIFIED', 'REJECTED'],
        CompensationType: ['LOST', 'DAMAGED', 'DELAYED'],
        CompensationStatus: ['PENDING_REVIEW', 'UNDER_INVESTIGATION', 'APPROVED', 'REJECTED', 'PAID'],
        AttemptOrigin: ['INITIAL', 'RETRY', 'MANUAL'],
        PaymentAttemptStatus: ['PENDING', 'SUCCESS', 'FAILED', 'TIMEOUT'],
        DisputeStatus: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'ESCALATED'],
      },

      breakingChangesSinceV1: [
        'Trust level is now computed server-side — do not infer from trustScore alone',
        'deliveryConfirmedAt replaces deliveredAt for delivery date',
        'Trip.carrierId is the traveler identifier (not travelerId)',
        'Payout auto-eligibility requires admin approval — not fully automatic',
        'Protection Valises added — use /compensation/request (not assurance)',
        'PaymentAttempt entity added — pspReference now tracked per attempt',
        'Notification outbox added — NOTIFICATIONS_ENABLED=false by default',
      ],
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