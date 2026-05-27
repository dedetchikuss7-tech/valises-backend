import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CorridorCacheService } from '../corridors/corridor-cache.service';
import { UpdateCorridorLimitsDto } from './dto/corridor-limits.dto';

export class PricingUpdateDto {
  basePriceXaf?: number;
  pricePerKgXaf?: number;
  minPriceXaf?: number;
  maxPriceXaf?: number;
  commissionRate?: number;
  effectiveAt?: string;
}

export interface PricingPreviewResult {
  corridorCode: string;
  currentPricing: Record<string, unknown>;
  proposedPricing: PricingUpdateDto;
  estimatedImpact: {
    priceChangePercent: number | null;
    note: string;
  };
}

@Injectable()
export class CorridorAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly corridorCache: CorridorCacheService,
  ) {}

  async listCorridors() {
    return this.prisma.corridor.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async updateStatus(code: string, isActive: boolean, adminUserId: string) {
    const corridor = await this.prisma.corridor.findUnique({ where: { code } });

    if (!corridor) {
      throw new NotFoundException(`Corridor not found: ${code}`);
    }

    const updated = await this.prisma.corridor.update({
      where: { code },
      data: { isActive },
    });

    await this.recordAuditEvent({
      adminUserId,
      action: isActive ? 'CORRIDOR_ACTIVATED' : 'CORRIDOR_DEACTIVATED',
      targetType: 'CORRIDOR',
      targetId: code,
      metadata: { previousStatus: corridor.isActive, newStatus: isActive },
    });

    this.corridorCache.invalidate('corridors:active:list');
    this.corridorCache.invalidate(`corridors:detail:${code}`);

    return updated;
  }

  async updatePricing(code: string, dto: PricingUpdateDto, adminUserId: string) {
    const corridor = await this.prisma.corridor.findUnique({ where: { code } });

    if (!corridor) {
      throw new NotFoundException(`Corridor not found: ${code}`);
    }

    if (
      dto.commissionRate !== undefined &&
      (dto.commissionRate < 0 || dto.commissionRate > 1)
    ) {
      throw new BadRequestException('commissionRate must be between 0 and 1');
    }

    const currentSnapshot = {
      snapshotAt: new Date().toISOString(),
      basePriceXaf: corridor.basePriceXaf ?? null,
      pricePerKgXaf: corridor.pricePerKgXaf ?? null,
      minPriceXaf: corridor.minPriceXaf ?? null,
      maxPriceXaf: corridor.maxPriceXaf ?? null,
      commissionRate: corridor.commissionRate ?? null,
    };

    const existingHistory: unknown[] = Array.isArray(corridor.pricingHistory)
      ? (corridor.pricingHistory as unknown[])
      : [];

    const updatedHistory = [...existingHistory, currentSnapshot].slice(-20);

    const updateData: Prisma.CorridorUpdateInput = {
      pricingHistory: updatedHistory as Prisma.InputJsonValue,
    };
    if (dto.basePriceXaf !== undefined) updateData.basePriceXaf = dto.basePriceXaf;
    if (dto.pricePerKgXaf !== undefined) updateData.pricePerKgXaf = dto.pricePerKgXaf;
    if (dto.minPriceXaf !== undefined) updateData.minPriceXaf = dto.minPriceXaf;
    if (dto.maxPriceXaf !== undefined) updateData.maxPriceXaf = dto.maxPriceXaf;
    if (dto.commissionRate !== undefined) updateData.commissionRate = dto.commissionRate;
    if (dto.effectiveAt !== undefined) updateData.effectiveAt = new Date(dto.effectiveAt);

    const updated = await this.prisma.corridor.update({
      where: { code },
      data: updateData,
    });

    await this.recordAuditEvent({
      adminUserId,
      action: 'CORRIDOR_PRICING_UPDATED',
      targetType: 'CORRIDOR',
      targetId: code,
      metadata: { previous: currentSnapshot, proposed: dto },
    });

    this.corridorCache.invalidate('corridors:active:list');
    this.corridorCache.invalidate(`corridors:detail:${code}`);

    return updated;
  }

  async previewPricing(code: string, dto: PricingUpdateDto): Promise<PricingPreviewResult> {
    const corridor = await this.prisma.corridor.findUnique({ where: { code } });

    if (!corridor) {
      throw new NotFoundException(`Corridor not found: ${code}`);
    }

    const currentBase = corridor.basePriceXaf ?? null;
    const proposedBase = dto.basePriceXaf ?? null;

    let priceChangePercent: number | null = null;
    if (currentBase !== null && proposedBase !== null && currentBase !== 0) {
      priceChangePercent =
        Math.round(((proposedBase - currentBase) / currentBase) * 100 * 100) / 100;
    }

    const currentPricing: Record<string, unknown> = {
      basePriceXaf: corridor.basePriceXaf ?? null,
      pricePerKgXaf: corridor.pricePerKgXaf ?? null,
      minPriceXaf: corridor.minPriceXaf ?? null,
      maxPriceXaf: corridor.maxPriceXaf ?? null,
      commissionRate: corridor.commissionRate ?? null,
    };

    return {
      corridorCode: code,
      currentPricing,
      proposedPricing: dto,
      estimatedImpact: {
        priceChangePercent,
        note:
          priceChangePercent === null
            ? 'Insufficient data to compute price change'
            : `Base price would change by ${priceChangePercent > 0 ? '+' : ''}${priceChangePercent}%`,
      },
    };
  }

  async updateCorridorLimits(
    code: string,
    adminId: string,
    dto: UpdateCorridorLimitsDto,
  ) {
    const corridor = await this.prisma.corridor.findFirst({
      where: { code },
      select: { id: true, code: true },
    });

    if (!corridor) {
      throw new NotFoundException(`Corridor ${code} not found`);
    }

    const updated = await this.prisma.corridor.update({
      where: { id: corridor.id },
      data: {
        maxWeightKg: dto.maxWeightKg ?? null,
        maxVolumeL: dto.maxVolumeL ?? null,
        strictLimits: dto.strictLimits,
      },
      select: {
        code: true,
        maxWeightKg: true,
        maxVolumeL: true,
        strictLimits: true,
      },
    });

    await this.recordAuditEvent({
      adminUserId: adminId,
      action: 'CORRIDOR_LIMITS_UPDATE',
      targetType: 'CORRIDOR',
      targetId: corridor.id,
      metadata: {
        maxWeightKg: dto.maxWeightKg,
        maxVolumeL: dto.maxVolumeL,
        strictLimits: dto.strictLimits,
      },
    });

    this.corridorCache.invalidate('corridors:active:list');
    this.corridorCache.invalidate(`corridors:detail:${code}`);

    return updated;
  }

  async validatePackageLimits(
    corridorId: string,
    weightKg?: number,
    volumeL?: number,
  ): Promise<{ warning: string | null }> {
    const corridor = await this.prisma.corridor.findUnique({
      where: { id: corridorId },
      select: { maxWeightKg: true, maxVolumeL: true, strictLimits: true, code: true },
    });

    if (!corridor) return { warning: null };

    const warnings: string[] = [];

    if (corridor.maxWeightKg !== null && weightKg !== undefined) {
      if (weightKg > corridor.maxWeightKg) {
        if (corridor.strictLimits) {
          throw new BadRequestException(
            `Package weight ${weightKg}kg exceeds corridor limit of ${corridor.maxWeightKg}kg`,
          );
        }
        warnings.push(
          `Weight ${weightKg}kg exceeds recommended limit of ${corridor.maxWeightKg}kg for corridor ${corridor.code}`,
        );
      }
    }

    if (corridor.maxVolumeL !== null && volumeL !== undefined) {
      if (volumeL > corridor.maxVolumeL) {
        if (corridor.strictLimits) {
          throw new BadRequestException(
            `Package volume ${volumeL}L exceeds corridor limit of ${corridor.maxVolumeL}L`,
          );
        }
        warnings.push(
          `Volume ${volumeL}L exceeds recommended limit of ${corridor.maxVolumeL}L for corridor ${corridor.code}`,
        );
      }
    }

    return { warning: warnings.length > 0 ? warnings.join('; ') : null };
  }

  private async recordAuditEvent(event: {
    adminUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata: Record<string, unknown>;
  }) {
    try {
      await this.prisma.adminActionAudit.create({
        data: {
          action: event.action,
          targetType: event.targetType,
          targetId: event.targetId,
          actorUserId: event.adminUserId,
          metadata: event.metadata as Prisma.InputJsonValue,
        },
      });
    } catch {
      console.warn('[CorridorAdmin] Audit trail skipped:', event.action);
    }
  }
}
