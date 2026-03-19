import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, AdminActionAudit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListAdminActionAuditsQueryDto } from './dto/list-admin-action-audits-query.dto';

type RecordAdminActionAuditInput = {
  action: string;
  targetType: string;
  targetId: string;
  actorUserId?: string | null;
  metadata?: Record<string, unknown> | null;
};

@Injectable()
export class AdminActionAuditService {
  private readonly logger = new Logger(AdminActionAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAdminActionAuditInput): Promise<AdminActionAudit> {
    return this.prisma.adminActionAudit.create({
      data: {
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        actorUserId: input.actorUserId ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async recordSafe(input: RecordAdminActionAuditInput): Promise<void> {
    try {
      await this.record(input);
    } catch (error) {
      this.logger.error(
        `Failed to record admin action audit: ${input.action} ${input.targetType}:${input.targetId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async list(query: ListAdminActionAuditsQueryDto) {
    const where: Prisma.AdminActionAuditWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
    };

    const items = await this.prisma.adminActionAudit.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit ?? 50,
    });

    return {
      items,
      limit: query.limit ?? 50,
      filters: {
        action: query.action ?? null,
        targetType: query.targetType ?? null,
        targetId: query.targetId ?? null,
        actorUserId: query.actorUserId ?? null,
      },
    };
  }

  async getOne(id: string) {
    const item = await this.prisma.adminActionAudit.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('Admin action audit not found');
    }

    return item;
  }
}