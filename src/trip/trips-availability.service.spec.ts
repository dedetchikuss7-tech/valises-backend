import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AbandonmentService } from '../abandonment/abandonment.service';
import { STORAGE_PROVIDER } from '../storage/storage.provider';
import { TripService } from './trip.service';

describe('TripService — availability', () => {
  let service: TripService;

  const mockPrisma = {
    trip: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const abandonmentMock = {
    markAbandoned: jest.fn(),
    resolveActiveByReference: jest.fn(),
  };

  const storageProviderMock = {
    prepareUpload: jest.fn(),
    confirmUpload: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AbandonmentService, useValue: abandonmentMock },
        { provide: STORAGE_PROVIDER, useValue: storageProviderMock },
      ],
    }).compile();

    service = module.get<TripService>(TripService);
  });

  describe('getAvailableTrips', () => {
    it('returns trips for corridor without date filter', async () => {
      mockPrisma.trip.findMany.mockResolvedValue([
        {
          id: 't1',
          carrierId: 'c1',
          departureDate: new Date('2026-06-10'),
          arrivalDate: new Date('2026-06-11'),
          status: 'ACTIVE',
          capacityKg: 20,
          corridor: { code: 'CMR-FR', name: 'Cameroun → France' },
          carrier: { id: 'c1', trustProfile: { score: 60 } },
        },
      ]);

      const result = await service.getAvailableTrips({ corridorCode: 'CMR-FR' });
      expect(result).toHaveLength(1);
      expect(mockPrisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            corridor: expect.objectContaining({ code: 'CMR-FR' }),
          }),
        }),
      );
    });

    it('includes trips with null departureDate when date filter applied', async () => {
      mockPrisma.trip.findMany.mockResolvedValue([]);

      await service.getAvailableTrips({
        corridorCode: 'CMR-FR',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
      });

      const call = mockPrisma.trip.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
      const nullEntry = call.where.OR.find((o: any) => o.departureDate === null);
      expect(nullEntry).toBeDefined();
    });

    it('filters ACTIVE trips only', async () => {
      mockPrisma.trip.findMany.mockResolvedValue([]);

      await service.getAvailableTrips({});

      const call = mockPrisma.trip.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('ACTIVE');
    });

    it('limits to 50 results', async () => {
      mockPrisma.trip.findMany.mockResolvedValue([]);

      await service.getAvailableTrips({});

      const call = mockPrisma.trip.findMany.mock.calls[0][0];
      expect(call.take).toBe(50);
    });

    it('returns trips without corridor filter when no corridorCode given', async () => {
      mockPrisma.trip.findMany.mockResolvedValue([]);

      await service.getAvailableTrips({ dateFrom: '2026-06-01' });

      const call = mockPrisma.trip.findMany.mock.calls[0][0];
      expect(call.where.corridor).toBeDefined();
      expect(call.where.corridor.code).toBeUndefined();
    });
  });

  describe('closeTrip', () => {
    it('closes a trip when called by the carrier', async () => {
      mockPrisma.trip.findUnique.mockResolvedValue({
        id: 't1',
        carrierId: 'u1',
        status: 'ACTIVE',
      });
      mockPrisma.trip.update.mockResolvedValue({
        id: 't1',
        status: 'CLOSED',
        carrierId: 'u1',
      });

      const result = await service.closeTrip('t1', 'u1');
      expect(result.status).toBe('CLOSED');
    });

    it('throws ForbiddenException when non-carrier tries to close', async () => {
      mockPrisma.trip.findUnique.mockResolvedValue({
        id: 't1',
        carrierId: 'u1',
        status: 'ACTIVE',
      });

      await expect(service.closeTrip('t1', 'stranger')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for unknown trip', async () => {
      mockPrisma.trip.findUnique.mockResolvedValue(null);

      await expect(service.closeTrip('bad-id', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('calls prisma.trip.update with CLOSED status', async () => {
      mockPrisma.trip.findUnique.mockResolvedValue({
        id: 't1',
        carrierId: 'u1',
        status: 'ACTIVE',
      });
      mockPrisma.trip.update.mockResolvedValue({
        id: 't1',
        status: 'CLOSED',
        carrierId: 'u1',
      });

      await service.closeTrip('t1', 'u1');

      expect(mockPrisma.trip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't1' },
          data: { status: 'CLOSED' },
        }),
      );
    });
  });
});
