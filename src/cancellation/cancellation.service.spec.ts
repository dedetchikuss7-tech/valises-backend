import { Test, TestingModule } from '@nestjs/testing';
import { CancellationService } from './cancellation.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

const mockTransaction = {
  id: 'tx-1',
  senderId: 'sender-1',
  travelerId: 'traveler-1',
  amount: 15000,
  status: 'PAID',
  paymentStatus: 'SUCCESS',
};

const mockTx = {
  transaction: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  ledgerEntry: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  adminActionAudit: {
    create: jest.fn(),
  },
};

const mockPrisma = {
  $transaction: jest.fn((cb) => cb(mockTx)),
};

describe('CancellationService', () => {
  let service: CancellationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancellationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CancellationService>(CancellationService);
    jest.clearAllMocks();
  });

  describe('cancelTransaction', () => {
    it('cancels a PAID transaction and creates REFUND ledger entry', async () => {
      mockTx.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockTx.transaction.update.mockResolvedValue({ ...mockTransaction, status: 'CANCELLED' });
      mockTx.ledgerEntry.findUnique.mockResolvedValue(null);
      mockTx.ledgerEntry.create.mockResolvedValue({});
      mockTx.adminActionAudit.create.mockResolvedValue({});

      const result = await service.cancelTransaction('tx-1', 'sender-1');
      expect(result.status).toBe('CANCELLED');
      expect(mockTx.ledgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'ESCROW_DEBIT_REFUND', amount: 15000 }),
        }),
      );
    });

    it('cancels a CREATED transaction without ledger entry', async () => {
      mockTx.transaction.findUnique.mockResolvedValue({
        ...mockTransaction,
        status: 'CREATED',
        paymentStatus: 'PENDING',
      });
      mockTx.transaction.update.mockResolvedValue({ ...mockTransaction, status: 'CANCELLED' });
      mockTx.adminActionAudit.create.mockResolvedValue({});

      await service.cancelTransaction('tx-1', 'sender-1');
      expect(mockTx.ledgerEntry.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException if requester is not the sender', async () => {
      mockTx.transaction.findUnique.mockResolvedValue(mockTransaction);
      await expect(service.cancelTransaction('tx-1', 'other-user')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if status is IN_TRANSIT', async () => {
      mockTx.transaction.findUnique.mockResolvedValue({ ...mockTransaction, status: 'IN_TRANSIT' });
      await expect(service.cancelTransaction('tx-1', 'sender-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown transaction', async () => {
      mockTx.transaction.findUnique.mockResolvedValue(null);
      await expect(service.cancelTransaction('unknown', 'sender-1')).rejects.toThrow(NotFoundException);
    });

    it('is idempotent — skips refund entry if already exists', async () => {
      mockTx.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockTx.transaction.update.mockResolvedValue({ ...mockTransaction, status: 'CANCELLED' });
      mockTx.ledgerEntry.findUnique.mockResolvedValue({ id: 'existing-refund' });
      mockTx.adminActionAudit.create.mockResolvedValue({});

      await service.cancelTransaction('tx-1', 'sender-1');
      expect(mockTx.ledgerEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('forceCancelTransaction', () => {
    it('force-cancels a transaction in any non-terminal status', async () => {
      mockTx.transaction.findUnique.mockResolvedValue({ ...mockTransaction, status: 'IN_TRANSIT' });
      mockTx.transaction.update.mockResolvedValue({ ...mockTransaction, status: 'CANCELLED' });
      mockTx.ledgerEntry.findUnique.mockResolvedValue(null);
      mockTx.ledgerEntry.create.mockResolvedValue({});
      mockTx.adminActionAudit.create.mockResolvedValue({});

      const result = await service.forceCancelTransaction('tx-1', 'admin-1');
      expect(result.status).toBe('CANCELLED');
    });

    it('throws BadRequestException if already CANCELLED', async () => {
      mockTx.transaction.findUnique.mockResolvedValue({ ...mockTransaction, status: 'CANCELLED' });
      await expect(service.forceCancelTransaction('tx-1', 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if status is DELIVERED', async () => {
      mockTx.transaction.findUnique.mockResolvedValue({ ...mockTransaction, status: 'DELIVERED' });
      await expect(service.forceCancelTransaction('tx-1', 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown transaction', async () => {
      mockTx.transaction.findUnique.mockResolvedValue(null);
      await expect(service.forceCancelTransaction('unknown', 'admin-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('chaos — concurrent cancellation', () => {
    it('handles concurrent cancel calls safely via Prisma $transaction', async () => {
      mockTx.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockTx.transaction.update
        .mockResolvedValueOnce({ ...mockTransaction, status: 'CANCELLED' })
        .mockRejectedValueOnce(new Error('Record not found'));
      mockTx.ledgerEntry.findUnique.mockResolvedValue(null);
      mockTx.ledgerEntry.create.mockResolvedValue({});
      mockTx.adminActionAudit.create.mockResolvedValue({});

      const [result1, result2] = await Promise.allSettled([
        service.cancelTransaction('tx-1', 'sender-1'),
        service.cancelTransaction('tx-1', 'sender-1'),
      ]);

      expect(result1.status).toBe('fulfilled');
      expect(result2.status).toBe('rejected');
    });
  });
});
