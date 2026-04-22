import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AbandonmentEventStatus,
  AdminActionAudit,
  AmlCaseStatus,
  DisputeStatus,
  PayoutStatus,
  RefundStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedListResponseDto } from '../common/dto/paginated-list-response.dto';
import { AddAdminCaseNoteDto } from './dto/add-admin-case-note.dto';
import { AdminCaseManagementResponseDto } from './dto/admin-case-management-response.dto';
import { AdminCaseTransitionDto } from './dto/admin-case-transition.dto';
import {
  AdminCaseDerivedStatus,
  AdminCaseSourceType,
  ListAdminCaseManagementQueryDto,
} from './dto/list-admin-case-management-query.dto';
import { OpenAdminCaseFromSourceDto } from './dto/open-admin-case-from-source.dto';

type NormalizedCaseSeed = {
  sourceType: AdminCaseSourceType;
  sourceId: string;
  transactionId: string | null;
  subjectUserId: string | null;
  secondaryUserId: string | null;
  title: string;
  subtitle: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date | null;
  metadata: Record<string, unknown> | null;
};

type DerivedCaseState = {
  status: AdminCaseDerivedStatus;
  assignedAdminId: string | null;
  notes: Array<{
    id: string;
    authorAdminId: string;
    note: string;
    createdAt: Date;
  }>;
  latestActionAt: Date | null;
};

@Injectable()
export class AdminCaseManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async listCases(
    query: ListAdminCaseManagementQueryDto,
  ): Promise<PaginatedListResponseDto<AdminCaseManagementResponseDto>> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const [seeds, audits] = await Promise.all([
      this.loadSeeds(query),
      this.loadRelevantAudits(),
    ]);

    let items = seeds.map((seed) => this.composeCase(seed, audits));

    if (query.status) {
      items = items.filter((item) => item.status === query.status);
    }

    if (query.assignedAdminId) {
      items = items.filter((item) => item.assignedAdminId === query.assignedAdminId);
    }

    if (query.requiresAction !== undefined) {
      items = items.filter((item) => item.requiresAction === query.requiresAction);
    }

    if (query.q) {
      const needle = query.q.trim().toLowerCase();
      items = items.filter((item) => {
        const haystack = [
          item.sourceType,
          item.sourceId,
          item.status,
          item.assignedAdminId ?? '',
          item.transactionId ?? '',
          item.subjectUserId ?? '',
          item.secondaryUserId ?? '',
          item.title,
          item.subtitle ?? '',
          ...item.tags,
          ...item.notes.map((note) => note.note),
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(needle);
      });
    }

    items.sort((a, b) => {
      const aTime = (a.updatedAt ?? a.createdAt).getTime();
      const bTime = (b.updatedAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });

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

  async getCase(sourceType: AdminCaseSourceType, sourceId: string) {
    const [seeds, audits] = await Promise.all([
      this.loadSeeds({ sourceType, limit: 100, offset: 0 }),
      this.loadRelevantAudits(),
    ]);

    const seed = seeds.find(
      (item) => item.sourceType === sourceType && item.sourceId === sourceId,
    );

    if (!seed) {
      throw new NotFoundException('Case source not found');
    }

    return this.composeCase(seed, audits);
  }

  async openFromSource(
    dto: OpenAdminCaseFromSourceDto,
    actorAdminId: string,
  ) {
    const existing = await this.findSeed(dto.sourceType, dto.sourceId);

    if (!existing) {
      throw new NotFoundException('Case source not found');
    }

    await this.prisma.adminActionAudit.create({
      data: {
        action: 'CASE_OPEN',
        targetType: dto.sourceType,
        targetId: dto.sourceId,
        actorUserId: actorAdminId,
        metadata: {
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
          note: dto.note ?? null,
          transactionId: existing.transactionId,
          subjectUserId: existing.subjectUserId,
          secondaryUserId: existing.secondaryUserId,
          title: existing.title,
        },
      },
    });

    return this.getCase(dto.sourceType, dto.sourceId);
  }

  async takeCase(
    sourceType: AdminCaseSourceType,
    sourceId: string,
    actorAdminId: string,
    dto: AdminCaseTransitionDto,
  ) {
    const existing = await this.findSeed(sourceType, sourceId);

    if (!existing) {
      throw new NotFoundException('Case source not found');
    }

    await this.prisma.adminActionAudit.create({
      data: {
        action: 'CASE_TAKE',
        targetType: sourceType,
        targetId: sourceId,
        actorUserId: actorAdminId,
        metadata: {
          note: dto.note ?? null,
          assignedAdminId: actorAdminId,
        },
      },
    });

    return this.getCase(sourceType, sourceId);
  }

  async releaseCase(
    sourceType: AdminCaseSourceType,
    sourceId: string,
    actorAdminId: string,
    dto: AdminCaseTransitionDto,
  ) {
    const existing = await this.findSeed(sourceType, sourceId);

    if (!existing) {
      throw new NotFoundException('Case source not found');
    }

    await this.prisma.adminActionAudit.create({
      data: {
        action: 'CASE_RELEASE',
        targetType: sourceType,
        targetId: sourceId,
        actorUserId: actorAdminId,
        metadata: {
          note: dto.note ?? null,
        },
      },
    });

    return this.getCase(sourceType, sourceId);
  }

  async resolveCase(
    sourceType: AdminCaseSourceType,
    sourceId: string,
    actorAdminId: string,
    dto: AdminCaseTransitionDto,
  ) {
    const existing = await this.findSeed(sourceType, sourceId);

    if (!existing) {
      throw new NotFoundException('Case source not found');
    }

    await this.prisma.adminActionAudit.create({
      data: {
        action: 'CASE_RESOLVE',
        targetType: sourceType,
        targetId: sourceId,
        actorUserId: actorAdminId,
        metadata: {
          note: dto.note ?? null,
          resolvedByAdminId: actorAdminId,
        },
      },
    });

    return this.getCase(sourceType, sourceId);
  }

  async addNote(
    sourceType: AdminCaseSourceType,
    sourceId: string,
    actorAdminId: string,
    dto: AddAdminCaseNoteDto,
  ) {
    const existing = await this.findSeed(sourceType, sourceId);

    if (!existing) {
      throw new NotFoundException('Case source not found');
    }

    await this.prisma.adminActionAudit.create({
      data: {
        action: 'CASE_NOTE',
        targetType: sourceType,
        targetId: sourceId,
        actorUserId: actorAdminId,
        metadata: {
          note: dto.note,
        },
      },
    });

    return this.getCase(sourceType, sourceId);
  }

  private composeCase(
    seed: NormalizedCaseSeed,
    audits: AdminActionAudit[],
  ): AdminCaseManagementResponseDto {
    const relevant = audits
      .filter(
        (audit) =>
          audit.targetType === seed.sourceType && audit.targetId === seed.sourceId,
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const derived = this.deriveState(relevant);

    return {
      sourceType: seed.sourceType,
      sourceId: seed.sourceId,
      status: derived.status,
      requiresAction: derived.status !== AdminCaseDerivedStatus.RESOLVED,
      assignedAdminId: derived.assignedAdminId,
      createdAt: seed.createdAt,
      updatedAt: derived.latestActionAt ?? seed.updatedAt ?? null,
      transactionId: seed.transactionId,
      subjectUserId: seed.subjectUserId,
      secondaryUserId: seed.secondaryUserId,
      title: seed.title,
      subtitle: seed.subtitle,
      tags: seed.tags,
      metadata: seed.metadata,
      notes: derived.notes,
    };
  }

  private deriveState(audits: AdminActionAudit[]): DerivedCaseState {
    let status = AdminCaseDerivedStatus.OPEN;
    let assignedAdminId: string | null = null;
    let latestActionAt: Date | null = null;

    const notes: Array<{
      id: string;
      authorAdminId: string;
      note: string;
      createdAt: Date;
    }> = [];

    for (const audit of audits) {
      latestActionAt = audit.createdAt;

      const metadata =
        audit.metadata && typeof audit.metadata === 'object'
          ? (audit.metadata as Record<string, unknown>)
          : {};

      if (audit.action === 'CASE_TAKE') {
        status = AdminCaseDerivedStatus.IN_PROGRESS;
        assignedAdminId = audit.actorUserId ?? null;
      }

      if (audit.action === 'CASE_RELEASE') {
        status = AdminCaseDerivedStatus.OPEN;
        assignedAdminId = null;
      }

      if (audit.action === 'CASE_RESOLVE') {
        status = AdminCaseDerivedStatus.RESOLVED;
        assignedAdminId = audit.actorUserId ?? assignedAdminId;
      }

      if (audit.action === 'CASE_NOTE') {
        const note = metadata.note;
        if (typeof note === 'string' && audit.actorUserId) {
          notes.push({
            id: audit.id,
            authorAdminId: audit.actorUserId,
            note,
            createdAt: audit.createdAt,
          });
        }
      }
    }

    return {
      status,
      assignedAdminId,
      notes,
      latestActionAt,
    };
  }

  private async loadRelevantAudits() {
    return this.prisma.adminActionAudit.findMany({
      where: {
        action: {
          in: ['CASE_OPEN', 'CASE_TAKE', 'CASE_RELEASE', 'CASE_RESOLVE', 'CASE_NOTE'],
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  private async loadSeeds(
    query: Partial<ListAdminCaseManagementQueryDto>,
  ): Promise<NormalizedCaseSeed[]> {
    const [aml, disputes, payouts, refunds, abandonment] = await Promise.all([
      this.loadAmlSeeds(query),
      this.loadDisputeSeeds(query),
      this.loadPayoutSeeds(query),
      this.loadRefundSeeds(query),
      this.loadAbandonmentSeeds(query),
    ]);

    return [...aml, ...disputes, ...payouts, ...refunds, ...abandonment];
  }

  private async findSeed(sourceType: AdminCaseSourceType, sourceId: string) {
    const seeds = await this.loadSeeds({ sourceType, limit: 500, offset: 0 });
    return seeds.find((item) => item.sourceType === sourceType && item.sourceId === sourceId) ?? null;
  }

  private async loadAmlSeeds(
    query: Partial<ListAdminCaseManagementQueryDto>,
  ): Promise<NormalizedCaseSeed[]> {
    if (query.sourceType && query.sourceType !== AdminCaseSourceType.AML) {
      return [];
    }

    const where: any = {};
    if (query.transactionId) where.transactionId = query.transactionId;
    if (query.userId) where.OR = [{ senderId: query.userId }, { travelerId: query.userId }];

    const rows = await this.prisma.amlCase.findMany({
      where,
      orderBy: [{ openedAt: 'desc' }],
      take: 100,
    });

    return rows.map((row) => ({
      sourceType: AdminCaseSourceType.AML,
      sourceId: row.id,
      transactionId: row.transactionId,
      subjectUserId: row.senderId,
      secondaryUserId: row.travelerId,
      title: `AML case ${row.currentAction}`,
      subtitle: row.reasonSummary ?? null,
      tags: [row.riskLevel, row.currentAction, row.status],
      createdAt: row.openedAt,
      updatedAt: row.updatedAt,
      metadata: {
        signalCount: row.signalCount,
        status: row.status,
        isOpen: row.status === AmlCaseStatus.OPEN,
      },
    }));
  }

  private async loadDisputeSeeds(
    query: Partial<ListAdminCaseManagementQueryDto>,
  ): Promise<NormalizedCaseSeed[]> {
    if (query.sourceType && query.sourceType !== AdminCaseSourceType.DISPUTE) {
      return [];
    }

    const where: any = {};
    if (query.transactionId) where.transactionId = query.transactionId;
    if (query.userId) {
      where.OR = [
        { openedById: query.userId },
        { transaction: { senderId: query.userId } },
        { transaction: { travelerId: query.userId } },
      ];
    }

    const rows = await this.prisma.dispute.findMany({
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
      sourceType: AdminCaseSourceType.DISPUTE,
      sourceId: row.id,
      transactionId: row.transactionId,
      subjectUserId: row.transaction?.senderId ?? null,
      secondaryUserId: row.transaction?.travelerId ?? null,
      title: `Dispute ${row.reasonCode}`,
      subtitle: row.reason ?? null,
      tags: [row.reasonCode, row.openingSource, row.status],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      metadata: {
        openedById: row.openedById,
        evidenceStatus: row.evidenceStatus,
        isOpen: row.status === DisputeStatus.OPEN,
      },
    }));
  }

  private async loadPayoutSeeds(
    query: Partial<ListAdminCaseManagementQueryDto>,
  ): Promise<NormalizedCaseSeed[]> {
    if (query.sourceType && query.sourceType !== AdminCaseSourceType.PAYOUT) {
      return [];
    }

    const where: any = {};
    if (query.transactionId) where.transactionId = query.transactionId;
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
      sourceType: AdminCaseSourceType.PAYOUT,
      sourceId: row.id,
      transactionId: row.transactionId,
      subjectUserId: row.transaction?.senderId ?? null,
      secondaryUserId: row.transaction?.travelerId ?? null,
      title: `Payout ${row.status}`,
      subtitle: row.failureReason ?? null,
      tags: [row.provider, row.status],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      metadata: {
        amount: row.amount,
        currency: row.currency,
        requiresAttention:
          row.status === PayoutStatus.REQUESTED ||
          row.status === PayoutStatus.PROCESSING ||
          row.status === PayoutStatus.FAILED,
      },
    }));
  }

  private async loadRefundSeeds(
    query: Partial<ListAdminCaseManagementQueryDto>,
  ): Promise<NormalizedCaseSeed[]> {
    if (query.sourceType && query.sourceType !== AdminCaseSourceType.REFUND) {
      return [];
    }

    const where: any = {};
    if (query.transactionId) where.transactionId = query.transactionId;
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
      sourceType: AdminCaseSourceType.REFUND,
      sourceId: row.id,
      transactionId: row.transactionId,
      subjectUserId: row.transaction?.senderId ?? null,
      secondaryUserId: row.transaction?.travelerId ?? null,
      title: `Refund ${row.status}`,
      subtitle: row.failureReason ?? null,
      tags: [row.provider, row.status],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      metadata: {
        amount: row.amount,
        currency: row.currency,
        requiresAttention:
          row.status === RefundStatus.REQUESTED ||
          row.status === RefundStatus.PROCESSING ||
          row.status === RefundStatus.FAILED,
      },
    }));
  }

  private async loadAbandonmentSeeds(
    query: Partial<ListAdminCaseManagementQueryDto>,
  ): Promise<NormalizedCaseSeed[]> {
    if (query.sourceType && query.sourceType !== AdminCaseSourceType.ABANDONMENT) {
      return [];
    }

    const where: any = {};
    if (query.transactionId) where.transactionId = query.transactionId;
    if (query.userId) where.userId = query.userId;

    const rows = await this.prisma.abandonmentEvent.findMany({
      where,
      orderBy: [{ abandonedAt: 'desc' }],
      take: 100,
      include: {
        reminderJobs: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      sourceType: AdminCaseSourceType.ABANDONMENT,
      sourceId: row.id,
      transactionId: row.transactionId ?? null,
      subjectUserId: row.userId,
      secondaryUserId: null,
      title: `Abandonment ${row.kind}`,
      subtitle: row.status,
      tags: [row.kind, row.status],
      createdAt: row.abandonedAt,
      updatedAt: row.updatedAt,
      metadata: {
        tripId: row.tripId ?? null,
        packageId: row.packageId ?? null,
        pendingReminderCount: row.reminderJobs.filter((job) => job.status === 'PENDING').length,
        isActive: row.status === AbandonmentEventStatus.ACTIVE,
      },
    }));
  }
}