import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CorridorCacheService } from './corridor-cache.service';

const CACHE_KEY_LIST = 'corridors:active:list';
const CACHE_KEY_DETAIL = (code: string) => `corridors:detail:${code}`;

@Injectable()
export class CorridorPublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CorridorCacheService,
  ) {}

  async listActiveCorridors() {
    const cached = this.cache.get<any[]>(CACHE_KEY_LIST);
    if (cached) return cached;

    const corridors = await this.prisma.corridor.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        basePriceXaf: true,
        minPriceXaf: true,
        maxPriceXaf: true,
        commissionRate: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    const result = corridors.map((c) => this.formatCorridor(c));
    this.cache.set(CACHE_KEY_LIST, result);
    return result;
  }

  async getCorridorByCode(code: string) {
    const cacheKey = CACHE_KEY_DETAIL(code);
    const cached = this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const corridor = await this.prisma.corridor.findFirst({
      where: { code, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        basePriceXaf: true,
        pricePerKgXaf: true,
        minPriceXaf: true,
        maxPriceXaf: true,
        commissionRate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!corridor) {
      throw new NotFoundException(`Corridor ${code} not found or inactive`);
    }

    const result = this.formatCorridorDetail(corridor);
    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Called after PATCH /admin/corridors/:code/status or pricing update.
   * Immediate invalidation — no waiting for TTL expiry.
   */
  invalidateCorridorCache(code?: string): void {
    this.cache.invalidate(CACHE_KEY_LIST);
    if (code) {
      this.cache.invalidate(CACHE_KEY_DETAIL(code));
    }
  }

  private formatCorridor(c: any) {
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      isActive: c.isActive,
      pricing: {
        basePriceXaf: c.basePriceXaf,
        minPriceXaf: c.minPriceXaf,
        maxPriceXaf: c.maxPriceXaf,
        commissionRate: c.commissionRate,
        note: 'indicative',
      },
    };
  }

  private formatCorridorDetail(c: any) {
    return {
      ...this.formatCorridor(c),
      pricing: {
        ...this.formatCorridor(c).pricing,
        pricePerKgXaf: c.pricePerKgXaf,
      },
      updatedAt: c.updatedAt,
    };
  }
}
