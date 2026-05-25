import { Test, TestingModule } from '@nestjs/testing';
import { CompensationService } from './compensation.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('CompensationService', () => {
  let service: CompensationService;
  let prisma: any;

  const NOW = Date.now();
  const DELIVERED_RECENT = new Date(NOW - 2 * 24 * 60 * 60 * 1000);
  const DELIVERED_OLD = new Date(NOW - 10 * 24 * 60 * 60 * 1000);

  const mockTransaction = {
    id: 'tx1',
    status: 'DELIVERED',
    senderId: 'sender1',
    deliveryConfirmedAt: DELIVERED_RECENT,
    compensationRequests: [],
  };

  const mockCreateParams = {
    transactionId: 'tx1',
    requestedById: 'sender1',
    type: 'LOST' as const,
    description: 'Colis introuvable à la livraison',
  };

  beforeEach(async () => {
    prisma = {
      transaction: { findUnique: jest.fn() },
      compensationRequest: {
        create: jest.fn().mockResolvedValue({ id: 'comp1', status: 'PENDING_REVIEW' }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompensationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CompensationService>(CompensationService);
  });

  describe('createRequest', () => {
    it('creates a request for eligible transaction', async () => {
      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      const result = await service.createRequest(mockCreateParams);
      expect(result.status).toBe('PENDING_REVIEW');
      expect(prisma.compensationRequest.create).toHaveBeenCalled();
    });

    it('throws NotFoundException for unknown transaction', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);
      await expect(service.createRequest(mockCreateParams)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if transaction not DELIVERED or DISPUTED', async () => {
      prisma.transaction.findUnique.mockResolvedValue({ ...mockTransaction, status: 'PAID' });
      await expect(service.createRequest(mockCreateParams)).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException if requestedById is not the sender', async () => {
      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      await expect(
        service.createRequest({ ...mockCreateParams, requestedById: 'traveler1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if outside 7-day window', async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        ...mockTransaction,
        deliveryConfirmedAt: DELIVERED_OLD,
      });
      await expect(service.createRequest(mockCreateParams)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if a request already exists for this transaction', async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        ...mockTransaction,
        compensationRequests: [{ id: 'existing' }],
      });
      await expect(service.createRequest(mockCreateParams)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if declaredValue exceeds max', async () => {
      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      await expect(
        service.createRequest({ ...mockCreateParams, declaredValue: 100000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts DISPUTED status as eligible', async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        ...mockTransaction,
        status: 'DISPUTED',
      });
      const result = await service.createRequest(mockCreateParams);
      expect(result.status).toBe('PENDING_REVIEW');
    });
  });

  describe('reviewRequest', () => {
    const mockRequest = {
      id: 'comp1',
      status: 'PENDING_REVIEW',
    };

    beforeEach(() => {
      prisma.compensationRequest.findUnique.mockResolvedValue(mockRequest);
      prisma.compensationRequest.update.mockResolvedValue({
        ...mockRequest,
        status: 'APPROVED',
        reviewedById: 'admin1',
      });
    });

    it('approves a pending request', async () => {
      const result = await service.reviewRequest({
        compensationId: 'comp1',
        adminId: 'admin1',
        decision: 'APPROVED',
        approvedAmount: 25000,
      });
      expect(prisma.compensationRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'APPROVED',
            reviewedById: 'admin1',
            approvedAmount: 25000,
          }),
        }),
      );
    });

    it('throws NotFoundException for unknown request', async () => {
      prisma.compensationRequest.findUnique.mockResolvedValue(null);
      await expect(
        service.reviewRequest({ compensationId: 'ghost', adminId: 'admin1', decision: 'APPROVED' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if already reviewed', async () => {
      prisma.compensationRequest.findUnique.mockResolvedValue({ ...mockRequest, status: 'APPROVED' });
      await expect(
        service.reviewRequest({ compensationId: 'comp1', adminId: 'admin1', decision: 'REJECTED' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if approvedAmount exceeds max', async () => {
      await expect(
        service.reviewRequest({
          compensationId: 'comp1',
          adminId: 'admin1',
          decision: 'APPROVED',
          approvedAmount: 75000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sets UNDER_INVESTIGATION status', async () => {
      prisma.compensationRequest.update.mockResolvedValue({ ...mockRequest, status: 'UNDER_INVESTIGATION' });
      await service.reviewRequest({
        compensationId: 'comp1',
        adminId: 'admin1',
        decision: 'UNDER_INVESTIGATION',
      });
      expect(prisma.compensationRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'UNDER_INVESTIGATION' }),
        }),
      );
    });
  });

  describe('getMyRequests', () => {
    it('returns requests for the given user', async () => {
      prisma.compensationRequest.findMany.mockResolvedValue([{ id: 'comp1' }]);
      const result = await service.getMyRequests('sender1');
      expect(result).toHaveLength(1);
      expect(prisma.compensationRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { requestedById: 'sender1' } }),
      );
    });
  });
});
