import { Test, TestingModule } from '@nestjs/testing';
import { WebhookRetryService } from './webhook-retry.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OperationalHealthService } from '../../operational-health/operational-health.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockPrisma = {
  providerEvent: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
};

const mockOperationalHealthService = {
  getHealthSnapshot: jest.fn(),
};

describe('WebhookRetryService', () => {
  let service: WebhookRetryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookRetryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OperationalHealthService, useValue: mockOperationalHealthService },
      ],
    }).compile();

    service = module.get<WebhookRetryService>(WebhookRetryService);
    jest.clearAllMocks();
    (service as any).__resetRateLimiter?.();
  });

  describe('getFailedWebhooks', () => {
    it('returns paginated failed events', async () => {
      mockPrisma.providerEvent.findMany.mockResolvedValue([
        { id: 'e1', provider: 'cinetpay', eventType: 'PAYMENT_SUCCESS', processingStatus: 'FAILED', failureReason: null, createdAt: new Date() },
        { id: 'e2', provider: 'cinetpay', eventType: 'PAYMENT_FAILED', processingStatus: 'FAILED', failureReason: null, createdAt: new Date() },
      ]);

      const result = await service.getFailedWebhooks({ limit: 20 });
      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(mockPrisma.providerEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { processingStatus: 'FAILED' } }),
      );
    });

    it('filters by provider', async () => {
      mockPrisma.providerEvent.findMany.mockResolvedValue([]);
      await service.getFailedWebhooks({ limit: 20, provider: 'stripe' });
      expect(mockPrisma.providerEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { processingStatus: 'FAILED', provider: 'stripe' } }),
      );
    });

    it('sets hasMore=true and nextCursor when page is full', async () => {
      const events = Array.from({ length: 21 }, (_, i) => ({
        id: `e${i}`, provider: 'cinetpay', eventType: 'PAYMENT_SUCCESS',
        processingStatus: 'FAILED', failureReason: null, createdAt: new Date(),
      }));
      mockPrisma.providerEvent.findMany.mockResolvedValue(events);
      const result = await service.getFailedWebhooks({ limit: 20 });
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('e19');
    });
  });

  describe('replayWebhook', () => {
    it('replays a FAILED event and resets it to RECEIVED', async () => {
      mockPrisma.providerEvent.findUnique.mockResolvedValue({
        id: 'e1', processingStatus: 'FAILED', provider: 'cinetpay', eventType: 'PAYMENT_SUCCESS',
      });
      mockPrisma.providerEvent.update.mockResolvedValue({
        id: 'e1', provider: 'cinetpay', eventType: 'PAYMENT_SUCCESS', processingStatus: 'RECEIVED',
      });

      const result = await service.replayWebhook('e1', 'admin1');
      expect(result.replayed).toBe(true);
      expect(result.event.processingStatus).toBe('RECEIVED');
      expect(mockPrisma.providerEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ processingStatus: 'RECEIVED' }) }),
      );
    });

    it('throws NotFoundException for unknown event', async () => {
      mockPrisma.providerEvent.findUnique.mockResolvedValue(null);
      await expect(service.replayWebhook('bad-id', 'admin1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when event is not FAILED', async () => {
      mockPrisma.providerEvent.findUnique.mockResolvedValue({
        id: 'e1', processingStatus: 'APPLIED',
      });
      await expect(service.replayWebhook('e1', 'admin1')).rejects.toThrow(BadRequestException);
    });

    it('enforces rate limit after 10 replays', async () => {
      mockPrisma.providerEvent.findUnique.mockResolvedValue({
        id: 'e1', processingStatus: 'FAILED', provider: 'cinetpay', eventType: 'PAYMENT_SUCCESS',
      });
      mockPrisma.providerEvent.update.mockResolvedValue({
        id: 'e1', provider: 'cinetpay', eventType: 'PAYMENT_SUCCESS', processingStatus: 'RECEIVED',
      });

      for (let i = 0; i < 10; i++) {
        await service.replayWebhook('e1', 'admin-rate-test');
      }
      await expect(service.replayWebhook('e1', 'admin-rate-test')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getWebhookStats', () => {
    it('computes failure rate per provider and global', async () => {
      mockPrisma.providerEvent.groupBy.mockResolvedValue([
        { provider: 'cinetpay', processingStatus: 'APPLIED', _count: { id: 90 } },
        { provider: 'cinetpay', processingStatus: 'FAILED', _count: { id: 10 } },
      ]);

      const result = await service.getWebhookStats({ days: 7 });
      expect(result.byProvider['cinetpay'].failureRate).toBe(10);
      expect(result.byProvider['cinetpay'].alert).toBe(true);
      expect(result.global.failureRate).toBe(10);
    });

    it('alert=false when failure rate <= 5%', async () => {
      mockPrisma.providerEvent.groupBy.mockResolvedValue([
        { provider: 'cinetpay', processingStatus: 'APPLIED', _count: { id: 97 } },
        { provider: 'cinetpay', processingStatus: 'FAILED', _count: { id: 3 } },
      ]);

      const result = await service.getWebhookStats({ days: 7 });
      expect(result.byProvider['cinetpay'].alert).toBe(false);
    });

    it('returns zero failure rate when no events', async () => {
      mockPrisma.providerEvent.groupBy.mockResolvedValue([]);
      const result = await service.getWebhookStats({ days: 7 });
      expect(result.global.total).toBe(0);
      expect(result.global.failureRate).toBe(0);
    });

    it('caps days at 30', async () => {
      mockPrisma.providerEvent.groupBy.mockResolvedValue([]);
      const result = await service.getWebhookStats({ days: 100 });
      expect(result.windowDays).toBe(30);
    });

    it('handles multiple providers independently', async () => {
      mockPrisma.providerEvent.groupBy.mockResolvedValue([
        { provider: 'cinetpay', processingStatus: 'APPLIED', _count: { id: 90 } },
        { provider: 'cinetpay', processingStatus: 'FAILED', _count: { id: 10 } },
        { provider: 'stripe', processingStatus: 'APPLIED', _count: { id: 100 } },
      ]);

      const result = await service.getWebhookStats({ days: 7 });
      expect(result.byProvider['cinetpay'].alert).toBe(true);
      expect(result.byProvider['stripe'].alert).toBe(false);
      expect(result.global.total).toBe(200);
      expect(result.global.failed).toBe(10);
    });
  });
});
