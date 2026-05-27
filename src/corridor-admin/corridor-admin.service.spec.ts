import { Test, TestingModule } from '@nestjs/testing';
import { CorridorAdminService } from './corridor-admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockCorridor = {
  id: 'corridor-1',
  code: 'DLA-YDE',
  name: 'Douala → Yaoundé',
  isActive: true,
  pricingHistory: [],
  basePriceXaf: 5000,
  pricePerKgXaf: 500,
  minPriceXaf: 3000,
  maxPriceXaf: 50000,
  commissionRate: 0.1,
  effectiveAt: null,
};

const mockPrisma = {
  corridor: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  adminTimeline: {
    create: jest.fn(),
  },
};

describe('CorridorAdminService', () => {
  let service: CorridorAdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorridorAdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CorridorAdminService>(CorridorAdminService);
    jest.clearAllMocks();
  });

  describe('listCorridors', () => {
    it('returns corridors ordered by name', async () => {
      mockPrisma.corridor.findMany.mockResolvedValue([mockCorridor]);
      const result = await service.listCorridors();
      expect(result).toHaveLength(1);
      expect(mockPrisma.corridor.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('updateStatus', () => {
    it('activates a corridor and records audit', async () => {
      mockPrisma.corridor.findUnique.mockResolvedValue({ ...mockCorridor, isActive: false });
      mockPrisma.corridor.update.mockResolvedValue({ ...mockCorridor, isActive: true });
      mockPrisma.adminTimeline.create.mockResolvedValue({});

      const result = await service.updateStatus('DLA-YDE', true, 'admin-1');
      expect(result.isActive).toBe(true);
      expect(mockPrisma.corridor.update).toHaveBeenCalledWith({
        where: { code: 'DLA-YDE' },
        data: { isActive: true },
      });
    });

    it('throws NotFoundException for unknown corridor', async () => {
      mockPrisma.corridor.findUnique.mockResolvedValue(null);
      await expect(service.updateStatus('UNKNOWN', true, 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deactivates a corridor', async () => {
      mockPrisma.corridor.findUnique.mockResolvedValue(mockCorridor);
      mockPrisma.corridor.update.mockResolvedValue({ ...mockCorridor, isActive: false });
      mockPrisma.adminTimeline.create.mockResolvedValue({});

      const result = await service.updateStatus('DLA-YDE', false, 'admin-1');
      expect(result.isActive).toBe(false);
    });
  });

  describe('updatePricing', () => {
    it('snapshots current pricing before update', async () => {
      mockPrisma.corridor.findUnique.mockResolvedValue(mockCorridor);
      mockPrisma.corridor.update.mockResolvedValue(mockCorridor);
      mockPrisma.adminTimeline.create.mockResolvedValue({});

      await service.updatePricing('DLA-YDE', { basePriceXaf: 6000 }, 'admin-1');

      const updateCall = mockPrisma.corridor.update.mock.calls[0][0];
      const history = updateCall.data.pricingHistory as unknown[];
      expect(history).toHaveLength(1);
      expect((history[0] as any).basePriceXaf).toBe(5000);
    });

    it('throws BadRequestException if commissionRate out of range', async () => {
      mockPrisma.corridor.findUnique.mockResolvedValue(mockCorridor);
      await expect(
        service.updatePricing('DLA-YDE', { commissionRate: 1.5 }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown corridor', async () => {
      mockPrisma.corridor.findUnique.mockResolvedValue(null);
      await expect(
        service.updatePricing('UNKNOWN', { basePriceXaf: 5000 }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('keeps a maximum of 20 history snapshots', async () => {
      const existingHistory = Array.from({ length: 20 }, (_, i) => ({
        snapshotAt: new Date().toISOString(),
        basePriceXaf: 1000 + i * 100,
      }));
      mockPrisma.corridor.findUnique.mockResolvedValue({
        ...mockCorridor,
        pricingHistory: existingHistory,
      });
      mockPrisma.corridor.update.mockResolvedValue(mockCorridor);
      mockPrisma.adminTimeline.create.mockResolvedValue({});

      await service.updatePricing('DLA-YDE', { basePriceXaf: 9000 }, 'admin-1');

      const updateCall = mockPrisma.corridor.update.mock.calls[0][0];
      expect((updateCall.data.pricingHistory as unknown[]).length).toBeLessThanOrEqual(20);
    });
  });

  describe('previewPricing', () => {
    it('returns preview without saving', async () => {
      mockPrisma.corridor.findUnique.mockResolvedValue(mockCorridor);
      mockPrisma.corridor.update.mockResolvedValue(mockCorridor);

      const result = await service.previewPricing('DLA-YDE', { basePriceXaf: 6000 });

      expect(result.corridorCode).toBe('DLA-YDE');
      expect(result.proposedPricing.basePriceXaf).toBe(6000);
      expect(result.currentPricing['basePriceXaf']).toBe(5000);
      expect(mockPrisma.corridor.update).not.toHaveBeenCalled();
    });

    it('calculates price change percentage correctly', async () => {
      mockPrisma.corridor.findUnique.mockResolvedValue(mockCorridor);
      const result = await service.previewPricing('DLA-YDE', { basePriceXaf: 6000 });
      expect(result.estimatedImpact.priceChangePercent).toBe(20);
    });

    it('returns null priceChangePercent when base price not provided', async () => {
      mockPrisma.corridor.findUnique.mockResolvedValue(mockCorridor);
      const result = await service.previewPricing('DLA-YDE', { commissionRate: 0.12 });
      expect(result.estimatedImpact.priceChangePercent).toBeNull();
    });

    it('throws NotFoundException for unknown corridor', async () => {
      mockPrisma.corridor.findUnique.mockResolvedValue(null);
      await expect(service.previewPricing('UNKNOWN', {})).rejects.toThrow(NotFoundException);
    });
  });
});
