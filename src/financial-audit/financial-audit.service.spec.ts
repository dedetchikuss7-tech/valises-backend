import { Test, TestingModule } from '@nestjs/testing';
import { FinancialAuditService } from './financial-audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockTransaction = {
  id: 'tx-1',
  senderId: 'sender-1',
  travelerId: 'traveler-1',
  amount: 15000,
  status: 'DELIVERED',
  paymentStatus: 'SUCCESS',
};

const mockPrisma = {
  transaction: { findUnique: jest.fn() },
  ledgerEntry: { findMany: jest.fn() },
  paymentAttempt: { findMany: jest.fn() },
  payout: { findMany: jest.fn() },
  dispute: { findFirst: jest.fn() },
  reconciliationCase: { findMany: jest.fn() },
  compensationRequest: { findMany: jest.fn() },
  fraudFlag: { findMany: jest.fn() },
  auditAccessLog: { create: jest.fn() },
};

describe('FinancialAuditService', () => {
  let service: FinancialAuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialAuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FinancialAuditService>(FinancialAuditService);
    jest.clearAllMocks();
  });

  describe('getTransactionAuditSnapshot', () => {
    beforeEach(() => {
      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockPrisma.ledgerEntry.findMany.mockResolvedValue([]);
      mockPrisma.paymentAttempt.findMany.mockResolvedValue([]);
      mockPrisma.payout.findMany.mockResolvedValue([]);
      mockPrisma.dispute.findFirst.mockResolvedValue(null);
      mockPrisma.reconciliationCase.findMany.mockResolvedValue([]);
      mockPrisma.compensationRequest.findMany.mockResolvedValue([]);
      mockPrisma.fraudFlag.findMany.mockResolvedValue([]);
      mockPrisma.auditAccessLog.create.mockResolvedValue({});
    });

    it('returns all sections even when empty', async () => {
      const result = await service.getTransactionAuditSnapshot('tx-1', 'admin-1');

      expect(result.transaction).toEqual(mockTransaction);
      expect(result.ledgerEntries).toEqual([]);
      expect(result.paymentAttempts).toEqual([]);
      expect(result.payouts).toEqual([]);
      expect(result.dispute).toBeNull();
      expect(result.reconciliationCases).toEqual([]);
      expect(result.compensationRequests).toEqual([]);
      expect(result.fraudFlags.sender).toEqual([]);
      expect(result.fraudFlags.traveler).toEqual([]);
    });

    it('throws NotFoundException when transaction does not exist', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);
      await expect(
        service.getTransactionAuditSnapshot('unknown', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('logs access on every call', async () => {
      await service.getTransactionAuditSnapshot('tx-1', 'admin-1');
      expect(mockPrisma.auditAccessLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accessedById: 'admin-1',
            targetType: 'TRANSACTION',
            targetId: 'tx-1',
          }),
        }),
      );
    });

    it('returns populated ledger entries when present', async () => {
      const entries = [
        { id: 'le-1', type: 'ESCROW_CREDIT', amount: 15000, transactionId: 'tx-1' },
        { id: 'le-2', type: 'COMMISSION_ACCRUAL', amount: 1500, transactionId: 'tx-1' },
      ];
      mockPrisma.ledgerEntry.findMany.mockResolvedValue(entries);

      const result = await service.getTransactionAuditSnapshot('tx-1', 'admin-1');
      expect(result.ledgerEntries).toHaveLength(2);
    });

    it('returns fraud flags for both sender and traveler', async () => {
      mockPrisma.fraudFlag.findMany
        .mockResolvedValueOnce([{ id: 'ff-1', userId: 'sender-1', type: 'VELOCITY', severity: 'HIGH', description: 'Too many transactions' }])
        .mockResolvedValueOnce([{ id: 'ff-2', userId: 'traveler-1', type: 'ADMIN_SUSPENSION', severity: 'CRITICAL', description: 'Manual ban' }]);

      const result = await service.getTransactionAuditSnapshot('tx-1', 'admin-1');
      expect(result.fraudFlags.sender).toHaveLength(1);
      expect(result.fraudFlags.traveler).toHaveLength(1);
    });

    it('returns dispute when present', async () => {
      const dispute = { id: 'disp-1', transactionId: 'tx-1', status: 'OPEN' };
      mockPrisma.dispute.findFirst.mockResolvedValue(dispute);

      const result = await service.getTransactionAuditSnapshot('tx-1', 'admin-1');
      expect(result.dispute).toEqual(dispute);
    });

    it('does not crash when access log fails', async () => {
      mockPrisma.auditAccessLog.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.getTransactionAuditSnapshot('tx-1', 'admin-1'),
      ).resolves.toBeDefined();
    });

    it('returns compensation requests when present', async () => {
      mockPrisma.compensationRequest.findMany.mockResolvedValue([
        { id: 'cr-1', transactionId: 'tx-1', status: 'PENDING_REVIEW', type: 'LOST' },
      ]);

      const result = await service.getTransactionAuditSnapshot('tx-1', 'admin-1');
      expect(result.compensationRequests).toHaveLength(1);
    });

    it('loads reconciliation cases when present', async () => {
      mockPrisma.reconciliationCase.findMany.mockResolvedValue([
        { id: 'rc-1', transactionId: 'tx-1', discrepancyType: 'AMOUNT_MISMATCH', severity: 'HIGH' },
      ]);

      const result = await service.getTransactionAuditSnapshot('tx-1', 'admin-1');
      expect(result.reconciliationCases).toHaveLength(1);
    });
  });
});
