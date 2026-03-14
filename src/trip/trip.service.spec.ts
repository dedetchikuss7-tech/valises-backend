import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AbandonmentKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AbandonmentService } from '../abandonment/abandonment.service';
import { TripService } from './trip.service';
import { AdminVerifyDecision } from './dto/admin-verify-ticket.dto';

describe('TripService', () => {
  let service: TripService;

  const prismaMock = {
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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AbandonmentService, useValue: abandonmentMock },
      ],
    }).compile();

    service = module.get<TripService>(TripService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create draft and mark abandonment', async () => {
    prismaMock.trip.create.mockResolvedValue({
      id: 'trip1',
      carrierId: 'user1',
      corridorId: 'corr1',
      status: 'DRAFT',
      flightTicketStatus: 'NOT_PROVIDED',
    });

    abandonmentMock.markAbandoned.mockResolvedValue({
      id: 'ab1',
      kind: AbandonmentKind.TRIP_DRAFT,
    });

    const result = await service.createDraft('user1', {
      corridorId: 'corr1',
      departAt: '2026-03-10T10:00:00.000Z',
      capacityKg: 20,
    });

    expect(result.id).toBe('trip1');
    expect(prismaMock.trip.create).toHaveBeenCalled();
    expect(abandonmentMock.markAbandoned).toHaveBeenCalled();
  });

  it('should submit ticket and refresh abandonment state', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({
      id: 'trip1',
      carrierId: 'user1',
      status: 'DRAFT',
      flightTicketStatus: 'NOT_PROVIDED',
    });

    prismaMock.trip.update.mockResolvedValue({
      id: 'trip1',
      flightTicketStatus: 'PROVIDED',
    });

    const result = await service.submitTicket('user1', 'trip1', {} as any);

    expect(result.flightTicketStatus).toBe('PROVIDED');
    expect(prismaMock.trip.update).toHaveBeenCalled();
    expect(abandonmentMock.markAbandoned).toHaveBeenCalled();
  });

  it('should throw if trip not found on submitTicket', async () => {
    prismaMock.trip.findUnique.mockResolvedValue(null);

    await expect(service.submitTicket('user1', 'missing', {} as any)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw if submitTicket on another user trip', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({
      id: 'trip1',
      carrierId: 'other-user',
      status: 'DRAFT',
    });

    await expect(service.submitTicket('user1', 'trip1', {} as any)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should throw if submitTicket when trip is not DRAFT', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({
      id: 'trip1',
      carrierId: 'user1',
      status: 'ACTIVE',
    });

    await expect(service.submitTicket('user1', 'trip1', {} as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should verify ticket', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({
      id: 'trip1',
      carrierId: 'user1',
      status: 'DRAFT',
    });

    prismaMock.trip.update.mockResolvedValue({
      id: 'trip1',
      flightTicketStatus: 'VERIFIED',
      verifiedById: 'admin1',
    });

    const result = await service.adminVerifyTicket(
      'admin1',
      'trip1',
      AdminVerifyDecision.VERIFIED,
    );

    expect(result.flightTicketStatus).toBe('VERIFIED');
    expect(prismaMock.trip.update).toHaveBeenCalled();
  });

  it('should mark abandonment again when admin rejects ticket', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({
      id: 'trip1',
      carrierId: 'user1',
      status: 'DRAFT',
    });

    prismaMock.trip.update.mockResolvedValue({
      id: 'trip1',
      flightTicketStatus: 'REJECTED',
      verifiedById: null,
    });

    const result = await service.adminVerifyTicket(
      'admin1',
      'trip1',
      AdminVerifyDecision.REJECTED,
    );

    expect(result.flightTicketStatus).toBe('REJECTED');
    expect(abandonmentMock.markAbandoned).toHaveBeenCalled();
  });

  it('should publish trip and resolve abandonment', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({
      id: 'trip1',
      carrierId: 'user1',
      status: 'DRAFT',
      flightTicketStatus: 'VERIFIED',
    });

    prismaMock.trip.update.mockResolvedValue({
      id: 'trip1',
      status: 'ACTIVE',
      flightTicketStatus: 'VERIFIED',
    });

    abandonmentMock.resolveActiveByReference.mockResolvedValue({
      resolvedCount: 1,
    });

    const result = await service.publish('user1', 'trip1');

    expect(result.status).toBe('ACTIVE');
    expect(prismaMock.trip.update).toHaveBeenCalled();
    expect(abandonmentMock.resolveActiveByReference).toHaveBeenCalled();
  });

  it('should reject publish if ticket not verified', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({
      id: 'trip1',
      carrierId: 'user1',
      status: 'DRAFT',
      flightTicketStatus: 'PROVIDED',
    });

    await expect(service.publish('user1', 'trip1')).rejects.toThrow(BadRequestException);
  });

  it('should list user trips', async () => {
    prismaMock.trip.findMany.mockResolvedValue([
      { id: 'trip1', carrierId: 'user1' },
      { id: 'trip2', carrierId: 'user1' },
    ]);

    const result = await service.findMine('user1');

    expect(result).toHaveLength(2);
    expect(prismaMock.trip.findMany).toHaveBeenCalledWith({
      where: { carrierId: 'user1' },
      orderBy: { createdAt: 'desc' },
    });
  });
});