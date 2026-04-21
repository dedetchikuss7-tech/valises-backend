import { Injectable } from '@nestjs/common';
import {
  AbandonmentEventStatus,
  AmlCaseStatus,
  BehaviorRestrictionStatus,
  DisputeStatus,
  PayoutStatus,
  RefundStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import { AdminOpsDashboardResponseDto } from './dto/admin-ops-dashboard-response.dto';
import {
  AdminOpsCaseType,
  ListAdminOpsCasesQueryDto,
} from './dto/list-admin-ops-cases-query.dto';

type NormalizedAdminOpsCase = {
  caseType: AdminOpsCaseType;
  caseId: string;
  status: string;
  priority: string;
  requiresAction: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  transactionId: string | null;
  subjectUserId: string | null;
  secondaryUserId: string | null;
  title: string;
  subtitle: string | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
};

@Injectable()
export class AdminOpsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(): Promise<AdminOpsDashboardResponseDto> {
    const [
      openAmlCases,
      openDisputes,
      activeRestrictions,
      pendingPayouts,
      pendingRefunds,
      activeAbandonmentEvents,
      pendingReminderJobs,
      visibleShortlistEntries,
    ] = await Promise.all([
      this.prisma.amlCase.count({
        where: { status: AmlCaseStatus.OPEN },
      }),
      this.prisma.dispute.count({
        where: { status: DisputeStatus.OPEN },
      }),
      this.prisma.behaviorRestriction.count({
        where: { status: BehaviorRestrictionStatus.ACTIVE },
      }),
      this.prisma.payout.count({
        where: {
          status: {
            in: [PayoutStatus.REQUESTED, PayoutStatus.PROCESSING, PayoutStatus.FAILED],
          },
        },
      }),
      this.prisma.refund.count({
        where: {
          status: {
            in: [RefundStatus.REQUESTED, RefundStatus.PROCESSING, RefundStatus.FAILED],
          },
        },
      }),
      this.prisma.abandonmentEvent.count({
        where: { status: AbandonmentEventStatus.ACTIVE },
      }),
      this.prisma.reminderJob.count({
        where: { status: 'PENDING' as any },
      }),
      this.prisma.packageTripShortlist.count({
        where: { isVisible: true },
      }),
    ]);

    return {
      generatedAt: new Date(),
      openAmlCases,
      openDisputes,
      activeRestrictions,
      pendingPayouts,
      pendingRefunds,
      activeAbandonmentEvents,
      pendingReminderJobs,
      visibleShortlistEntries,
      requiresActionCount:
        openAmlCases +
        openDisputes +
        activeRestrictions +
        pendingPayouts +
        pendingRefunds +
        activeAbandonmentEvents +
        pendingReminderJobs,
    };
  }

  async listCases(
    query: ListAdminOpsCasesQueryDto,
  ): Promise<PaginatedListResponseDto<NormalizedAdminOpsCase>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const [
      amlCases,
      disputes,
      restrictions,
      payouts,
      refunds,
      abandonmentEvents,
    ] = await Promise.all([
      this.loadAmlCases(query),
      this.loadDisputes(query),
      this.loadRestrictions(query),
      this.loadPayouts(query),
      this.loadRefunds(query),
      this.loadAbandonmentEvents(query),
    ]);

    let items = [
      ...amlCases,
      ...disputes,
      ...restrictions,
      ...payouts,
      ...refunds,
      ...abandonmentEvents,
    ];

    if (query.requiresAction !== undefined) {
      items = items.filter((item) => item.requiresAction === query.requiresAction);
    }

    if (query.q) {
      const needle = query.q.trim().toLowerCase();
      items = items.filter((item) => {
        const haystack = [
          item.caseType,
          item.caseId,
          item.status,
          item.priority,
          item.transactionId ?? '',
          item.subjectUserId ?? '',
          item.secondaryUserId ?? '',
          item.title,
          item.subtitle ?? '',
          ...item.tags,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(needle);
      });
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

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

  private async loadAmlCases(
    query: ListAdminOpsCasesQueryDto,
  ): Promise<NormalizedAdminOpsCase[]> {
    if (query.caseType && query.caseType !== AdminOpsCaseType.AML) {
      return [];
    }

    const where: any = {};

    if (query.transactionId) {
      where.transactionId = query.transactionId;
    }

    if (query.userId) {
      where.OR = [{ senderId: query.userId }, { travelerId: query.userId }];
    }

    if (query.status) {
      where.status = query.status;
    }

    const rows = await this.prisma.amlCase.findMany({
      where,
      orderBy: [{ openedAt: 'desc' }],
      take: 100,
    });

    return rows.map((row) => ({
      caseType: AdminOpsCaseType.AML,
      caseId: row.id,
      status: row.status,
      priority:
        row.riskLevel === 'CRITICAL' || row.riskLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
      requiresAction: row.status === AmlCaseStatus.OPEN,
      createdAt: row.openedAt,
      updatedAt: row.updatedAt,
      transactionId: row.transactionId,
      subjectUserId: row.senderId,
      secondaryUserId: row.travelerId,
      title: `AML case ${row.currentAction}`,
      subtitle: row.reasonSummary ?? null,
      tags: [row.riskLevel, row.currentAction],
      metadata: {
        signalCount: row.signalCount,
        reviewedById: row.reviewedById ?? null,
      },
    }));
  }

  private async loadDisputes(
    query: ListAdminOpsCasesQueryDto,
  ): Promise<NormalizedAdminOpsCase[]> {
    if (query.caseType && query.caseType !== AdminOpsCaseType.DISPUTE) {
      return [];
    }

    const where: any = {};

    if (query.transactionId) {
      where.transactionId = query.transactionId;
    }

    if (query.userId) {
      where.OR = [
        { openedById: query.userId },
        { transaction: { senderId: query.userId } },
        { transaction: { travelerId: query.userId } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    const rows = await this.prisma.dispute.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
      include: {
        resolution: true,
        transaction: {
          select: {
            senderId: true,
            travelerId: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      caseType: AdminOpsCaseType.DISPUTE,
      caseId: row.id,
      status: row.status,
      priority: row.status === DisputeStatus.OPEN ? 'HIGH' : 'MEDIUM',
      requiresAction: row.status === DisputeStatus.OPEN,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      transactionId: row.transactionId,
      subjectUserId: row.transaction?.senderId ?? null,
      secondaryUserId: row.transaction?.travelerId ?? null,
      title: `Dispute ${row.reasonCode}`,
      subtitle: row.reason ?? null,
      tags: [row.reasonCode, row.openingSource, row.status],
      metadata: {
        evidenceStatus: row.evidenceStatus,
        openedById: row.openedById,
        resolutionOutcome: row.resolution?.outcome ?? null,
      },
    }));
  }

  private async loadRestrictions(
    query: ListAdminOpsCasesQueryDto,
  ): Promise<NormalizedAdminOpsCase[]> {
    if (query.caseType && query.caseType !== AdminOpsCaseType.RESTRICTION) {
      return [];
    }

    const where: any = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const rows = await this.prisma.behaviorRestriction.findMany({
      where,
      orderBy: [{ imposedAt: 'desc' }],
      take: 100,
    });

    return rows.map((row) => ({
      caseType: AdminOpsCaseType.RESTRICTION,
      caseId: row.id,
      status: row.status,
      priority: row.status === BehaviorRestrictionStatus.ACTIVE ? 'HIGH' : 'LOW',
      requiresAction: row.status === BehaviorRestrictionStatus.ACTIVE,
      createdAt: row.imposedAt,
      updatedAt: row.updatedAt,
      transactionId: null,
      subjectUserId: row.userId,
      secondaryUserId: null,
      title: `Restriction ${row.kind}`,
      subtitle: row.reasonSummary ?? null,
      tags: [row.kind, row.scope, row.status],
      metadata: {
        reasonCode: row.reasonCode,
        imposedById: row.imposedById ?? null,
        releasedById: row.releasedById ?? null,
      },
    }));
  }

  private async loadPayouts(
    query: ListAdminOpsCasesQueryDto,
  ): Promise<NormalizedAdminOpsCase[]> {
    if (query.caseType && query.caseType !== AdminOpsCaseType.PAYOUT) {
      return [];
    }

    const where: any = {};

    if (query.transactionId) {
      where.transactionId = query.transactionId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.userId) {
      where.transaction = {
        OR: [{ senderId: query.userId }, { travelerId: query.userId }],
      };
    }

    const rows = await this.prisma.payout.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
      include: {
        transaction: {
          select: {
            senderId: true,
            travelerId: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      caseType: AdminOpsCaseType.PAYOUT,
      caseId: row.id,
      status: row.status,
      priority:
        row.status === PayoutStatus.FAILED
          ? 'HIGH'
          : row.status === PayoutStatus.REQUESTED || row.status === PayoutStatus.PROCESSING
            ? 'MEDIUM'
            : 'LOW',
      requiresAction:
        row.status === PayoutStatus.REQUESTED ||
        row.status === PayoutStatus.PROCESSING ||
        row.status === PayoutStatus.FAILED,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      transactionId: row.transactionId,
      subjectUserId: row.transaction?.senderId ?? null,
      secondaryUserId: row.transaction?.travelerId ?? null,
      title: `Payout ${row.status}`,
      subtitle: row.failureReason ?? null,
      tags: [row.provider, row.status],
      metadata: {
        amount: row.amount,
        currency: row.currency,
        railProvider: row.railProvider ?? null,
        payoutMethodType: row.payoutMethodType ?? null,
      },
    }));
  }

  private async loadRefunds(
    query: ListAdminOpsCasesQueryDto,
  ): Promise<NormalizedAdminOpsCase[]> {
    if (query.caseType && query.caseType !== AdminOpsCaseType.REFUND) {
      return [];
    }

    const where: any = {};

    if (query.transactionId) {
      where.transactionId = query.transactionId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.userId) {
      where.transaction = {
        OR: [{ senderId: query.userId }, { travelerId: query.userId }],
      };
    }

    const rows = await this.prisma.refund.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
      include: {
        transaction: {
          select: {
            senderId: true,
            travelerId: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      caseType: AdminOpsCaseType.REFUND,
      caseId: row.id,
      status: row.status,
      priority:
        row.status === RefundStatus.FAILED
          ? 'HIGH'
          : row.status === RefundStatus.REQUESTED || row.status === RefundStatus.PROCESSING
            ? 'MEDIUM'
            : 'LOW',
      requiresAction:
        row.status === RefundStatus.REQUESTED ||
        row.status === RefundStatus.PROCESSING ||
        row.status === RefundStatus.FAILED,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      transactionId: row.transactionId,
      subjectUserId: row.transaction?.senderId ?? null,
      secondaryUserId: row.transaction?.travelerId ?? null,
      title: `Refund ${row.status}`,
      subtitle: row.failureReason ?? null,
      tags: [row.provider, row.status],
      metadata: {
        amount: row.amount,
        currency: row.currency,
      },
    }));
  }

  private async loadAbandonmentEvents(
    query: ListAdminOpsCasesQueryDto,
  ): Promise<NormalizedAdminOpsCase[]> {
    if (query.caseType && query.caseType !== AdminOpsCaseType.ABANDONMENT) {
      return [];
    }

    const where: any = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.transactionId) {
      where.transactionId = query.transactionId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const rows = await this.prisma.abandonmentEvent.findMany({
      where,
      orderBy: [{ abandonedAt: 'desc' }],
      take: 100,
      include: {
        reminderJobs: {
          select: {
            id: true,
            status: true,
            scheduledFor: true,
          },
        },
      },
    });

    return rows.map((row) => {
      const pendingReminderCount = row.reminderJobs.filter(
        (job) => job.status === 'PENDING',
      ).length;

      return {
        caseType: AdminOpsCaseType.ABANDONMENT,
        caseId: row.id,
        status: row.status,
        priority:
          row.status === AbandonmentEventStatus.ACTIVE ? 'MEDIUM' : 'LOW',
        requiresAction:
          row.status === AbandonmentEventStatus.ACTIVE || pendingReminderCount > 0,
        createdAt: row.abandonedAt,
        updatedAt: row.updatedAt,
        transactionId: row.transactionId ?? null,
        subjectUserId: row.userId,
        secondaryUserId: null,
        title: `Abandonment ${row.kind}`,
        subtitle: pendingReminderCount > 0 ? `${pendingReminderCount} pending reminder(s)` : null,
        tags: [row.kind, row.status],
        metadata: {
          tripId: row.tripId ?? null,
          packageId: row.packageId ?? null,
          pendingReminderCount,
        },
      };
    });
  }
}