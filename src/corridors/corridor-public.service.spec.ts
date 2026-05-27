import { Test, TestingModule } from '@nestjs/testing';
import { CorridorPublicService } from './corridor-public.service';
import { CorridorCacheService } from './corridor-cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  corridor: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  invalidate: jest.fn(),
  invalidateAll: jest.fn(),
};

const baseCorridor = {
  id: 'c1',
  code: 'CMR-FR',
  name: 'Cameroun → France',
  isActive: true,
  basePriceXaf: 500000,
  pricePerKgXaf: 50000,
  minPriceXaf: 300000,
  maxPriceXaf: 2000000,
  commissionRate: 0.08,
  maxWeightKg: null,
  maxVolumeL: null,
  strictLimits: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CorridorPublicService', () => {
  let service: CorridorPublicService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorridorPublicService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CorridorCacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<CorridorPublicService>(CorridorPublicService);
    jest.clearAllMocks();
  });

  describe('listActiveCorridors', () => {
    it('returns cached result when available', async () => {
      const cached = [{ code: 'CMR-FR', name: 'Test' }];
      mockCache.get.mockReturnValue(cached);

      const result = await service.listActiveCorridors();
      expect(result).toBe(cached);
      expect(mockPrisma.corridor.findMany).not.toHaveBeenCalled();
    });

    it('queries DB and sets cache when no cache', async () => {
      mockCache.get.mockReturnValue(null);
      mockPrisma.corridor.findMany.mockResolvedValue([baseCorridor]);

      const result = await service.listActiveCorridors();
      expect(mockPrisma.corridor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
      expect(mockCache.set).toHaveBeenCalled();
      expect(result[0].pricing.note).toBe('indicative');
    });

    it('returns empty array when no active corridors', async () => {
      mockCache.get.mockReturnValue(null);
      mockPrisma.corridor.findMany.mockResolvedValue([]);

      const result = await service.listActiveCorridors();
      expect(result).toHaveLength(0);
    });
  });

  describe('getCorridorByCode', () => {
    it('returns corridor detail from cache', async () => {
      const cached = { code: 'CMR-FR' };
      mockCache.get.mockReturnValue(cached);

      const result = await service.getCorridorByCode('CMR-FR');
      expect(result).toBe(cached);
      expect(mockPrisma.corridor.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for unknown or inactive corridor', async () => {
      mockCache.get.mockReturnValue(null);
      mockPrisma.corridor.findFirst.mockResolvedValue(null);

      await expect(service.getCorridorByCode('UNKNOWN')).rejects.toThrow(NotFoundException);
    });

    it('returns detail with pricePerKgXaf included', async () => {
      mockCache.get.mockReturnValue(null);
      mockPrisma.corridor.findFirst.mockResolvedValue(baseCorridor);

      const result = await service.getCorridorByCode('CMR-FR');
      expect(result.pricing.pricePerKgXaf).toBe(50000);
    });

    it('returns limits object with null values when no limits configured', async () => {
      mockCache.get.mockReturnValue(null);
      mockPrisma.corridor.findFirst.mockResolvedValue(baseCorridor);

      const result = await service.getCorridorByCode('CMR-FR');
      expect(result.limits).toEqual({ maxWeightKg: null, maxVolumeL: null, strictLimits: false });
    });

    it('returns configured limits when set', async () => {
      mockCache.get.mockReturnValue(null);
      mockPrisma.corridor.findFirst.mockResolvedValue({
        ...baseCorridor,
        maxWeightKg: 25,
        maxVolumeL: 50,
        strictLimits: true,
      });

      const result = await service.getCorridorByCode('CMR-FR');
      expect(result.limits).toEqual({ maxWeightKg: 25, maxVolumeL: 50, strictLimits: true });
    });
  });

  describe('invalidateCorridorCache', () => {
    it('invalidates list cache and specific corridor cache', () => {
      service.invalidateCorridorCache('CMR-FR');
      expect(mockCache.invalidate).toHaveBeenCalledWith('corridors:active:list');
      expect(mockCache.invalidate).toHaveBeenCalledWith('corridors:detail:CMR-FR');
    });

    it('invalidates only list cache when no code provided', () => {
      service.invalidateCorridorCache();
      expect(mockCache.invalidate).toHaveBeenCalledWith('corridors:active:list');
      expect(mockCache.invalidate).toHaveBeenCalledTimes(1);
    });
  });
});

describe('CorridorCacheService', () => {
  let cache: CorridorCacheService;

  beforeEach(() => {
    cache = new CorridorCacheService();
  });

  it('returns null for missing key', () => {
    expect(cache.get('missing')).toBeNull();
  });

  it('returns stored value within TTL', () => {
    cache.set('key1', { data: 'test' });
    expect(cache.get('key1')).toEqual({ data: 'test' });
  });

  it('returns null after invalidation', () => {
    cache.set('key1', { data: 'test' });
    cache.invalidate('key1');
    expect(cache.get('key1')).toBeNull();
  });

  it('clears all entries on invalidateAll', () => {
    cache.set('key1', 'v1');
    cache.set('key2', 'v2');
    cache.invalidateAll();
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBeNull();
  });
});
