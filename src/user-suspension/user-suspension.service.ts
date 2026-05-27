import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserSuspensionService {
  constructor(private readonly prisma: PrismaService) {}

  async suspendUser(
    userId: string,
    adminId: string,
    reason: string,
    durationHours?: number,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User not found: ${userId}`);
    if (user.bannedAt) throw new BadRequestException('User is already banned.');

    const suspendedUntil = durationHours
      ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
      : null;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        suspendedAt: new Date(),
        suspendedReason: reason,
        suspendedById: adminId,
        suspendedUntil,
      },
    });

    await this.prisma.fraudFlag.create({
      data: {
        userId,
        type: 'ADMIN_SUSPENSION',
        severity: 'HIGH',
        description: reason,
        metadata: { createdById: adminId },
      },
    });

    await this.recordAudit(adminId, 'USER_SUSPENDED', userId, {
      reason,
      durationHours: durationHours ?? null,
      suspendedUntil: suspendedUntil?.toISOString() ?? null,
    });

    return updated;
  }

  async unsuspendUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User not found: ${userId}`);
    if (!user.suspendedAt) throw new BadRequestException('User is not suspended.');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        suspendedAt: null,
        suspendedReason: null,
        suspendedById: null,
        suspendedUntil: null,
      },
    });

    await this.recordAudit(adminId, 'USER_UNSUSPENDED', userId, {
      reason: 'Admin manual unsuspend',
    });

    return updated;
  }

  async banUser(userId: string, adminId: string, reason: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User not found: ${userId}`);
    if (user.bannedAt) throw new BadRequestException('User is already banned.');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        bannedAt: new Date(),
        bannedReason: reason,
        bannedById: adminId,
        suspendedAt: null,
        suspendedReason: null,
        suspendedById: null,
        suspendedUntil: null,
      },
    });

    await this.recordAudit(adminId, 'USER_BANNED', userId, { reason });

    return updated;
  }

  async getUserStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        bannedAt: true,
        bannedReason: true,
        suspendedAt: true,
        suspendedReason: true,
        suspendedUntil: true,
        appealRequestedAt: true,
      },
    });
    if (!user) throw new NotFoundException(`User not found: ${userId}`);
    return user;
  }

  private async recordAudit(
    adminUserId: string,
    action: string,
    targetId: string,
    metadata: Record<string, unknown>,
  ) {
    try {
      await this.prisma.adminActionAudit.create({
        data: {
          actorUserId: adminUserId,
          action,
          targetType: 'USER',
          targetId,
          metadata: metadata as any,
        },
      });
    } catch {
      console.warn('[UserSuspension] Audit trail skipped:', action);
    }
  }
}
