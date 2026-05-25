import { Test, TestingModule } from '@nestjs/testing';
import { PaymentAttemptService } from './payment-attempt.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PaymentAttemptService', () => {
  let service: PaymentAttemptService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      paymentAttempt: {
        create: jest.fn().mockResolvedValue({ id: 'att1', attemptNumber: 1, status: 'PENDING' }),
        update: jest.fn().mockResolvedValue({ id: 'att1', status: 'SUCCESS' }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentAttemptService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PaymentAttemptService>(PaymentAttemptService);
  });

  describe('createAttempt', () => {
    it('creates a PENDING attempt with attemptNumber 1 for first attempt', async () => {
      prisma.paymentAttempt.count.mockResolvedValue(0);

      await service.createAttempt({
        transactionId: 'tx1',
        attemptOrigin: 'INITIAL',
      });

      expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attemptNumber: 1,
            status: 'PENDING',
            attemptOrigin: 'INITIAL',
          }),
        }),
      );
    });

    it('increments attemptNumber based on existing count', async () => {
      prisma.paymentAttempt.count.mockResolvedValue(2);

      await service.createAttempt({
        transactionId: 'tx1',
        attemptOrigin: 'RETRY',
      });

      expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ attemptNumber: 3 }),
        }),
      );
    });

    it('defaults pspProvider to CINETPAY', async () => {
      await service.createAttempt({ transactionId: 'tx1', attemptOrigin: 'INITIAL' });

      expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ pspProvider: 'CINETPAY' }),
        }),
      );
    });

    it('uses custom pspProvider when provided', async () => {
      await service.createAttempt({
        transactionId: 'tx1',
        attemptOrigin: 'MANUAL',
        pspProvider: 'FLUTTERWAVE',
      });

      expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ pspProvider: 'FLUTTERWAVE' }),
        }),
      );
    });

    it('passes metadata when provided', async () => {
      await service.createAttempt({
        transactionId: 'tx1',
        attemptOrigin: 'INITIAL',
        metadata: { correlationId: 'tx1' },
      });

      expect(prisma.paymentAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ metadata: { correlationId: 'tx1' } }),
        }),
      );
    });
  });

  describe('resolveAttempt', () => {
    it('marks attempt as SUCCESS with pspReference', async () => {
      await service.resolveAttempt({
        attemptId: 'att1',
        status: 'SUCCESS',
        pspReference: 'psp_ref_123',
      });

      expect(prisma.paymentAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'att1' },
          data: expect.objectContaining({
            status: 'SUCCESS',
            pspReference: 'psp_ref_123',
            respondedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('marks attempt as FAILED with error details', async () => {
      await service.resolveAttempt({
        attemptId: 'att1',
        status: 'FAILED',
        errorCode: 'PSP_ERROR',
        errorMessage: 'Insufficient funds',
      });

      expect(prisma.paymentAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            errorCode: 'PSP_ERROR',
            errorMessage: 'Insufficient funds',
          }),
        }),
      );
    });

    it('marks attempt as TIMEOUT', async () => {
      await service.resolveAttempt({ attemptId: 'att1', status: 'TIMEOUT' });

      expect(prisma.paymentAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'TIMEOUT' }),
        }),
      );
    });
  });

  describe('getAttemptsForTransaction', () => {
    it('returns attempts ordered by attemptNumber', async () => {
      const attempts = [
        { id: 'att1', attemptNumber: 1 },
        { id: 'att2', attemptNumber: 2 },
      ];
      prisma.paymentAttempt.findMany.mockResolvedValue(attempts);

      const result = await service.getAttemptsForTransaction('tx1');

      expect(result).toHaveLength(2);
      expect(prisma.paymentAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { transactionId: 'tx1' },
          orderBy: { attemptNumber: 'asc' },
        }),
      );
    });

    it('returns empty array when no attempts exist', async () => {
      prisma.paymentAttempt.findMany.mockResolvedValue([]);
      const result = await service.getAttemptsForTransaction('tx_empty');
      expect(result).toEqual([]);
    });
  });

  describe('getSuccessfulAttempt', () => {
    it('returns the latest successful attempt', async () => {
      const attempt = { id: 'att1', status: 'SUCCESS', pspReference: 'psp_123' };
      prisma.paymentAttempt.findFirst.mockResolvedValue(attempt);

      const result = await service.getSuccessfulAttempt('tx1');

      expect(result?.pspReference).toBe('psp_123');
      expect(prisma.paymentAttempt.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { transactionId: 'tx1', status: 'SUCCESS' },
        }),
      );
    });

    it('returns null if no successful attempt exists', async () => {
      prisma.paymentAttempt.findFirst.mockResolvedValue(null);
      const result = await service.getSuccessfulAttempt('tx1');
      expect(result).toBeNull();
    });
  });
});
