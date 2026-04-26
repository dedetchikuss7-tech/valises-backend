import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AbandonmentKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AbandonmentService } from '../abandonment/abandonment.service';
import { STORAGE_PROVIDER } from '../storage/storage.provider';
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

  const storageProviderMock = {
    prepareUpload: jest.fn(),
    confirmUpload: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    storageProviderMock.prepareUpload.mockResolvedValue({
      provider: 'MOCK_STORAGE',
      storageKey: 'pending/trips/trip1/flight-ticket/user1/ticket.pdf',
      uploadUrl:
        'https://mock-storage.local/upload/pending%2Ftrips%2Ftrip1%2Fflight-ticket%2Fuser1%2Fticket.pdf?token=abc',
      method: 'PUT',
      headers: {
        'content-type': 'application/pdf',
        'x-mock-upload-token': 'abc',
      },
      expiresInSeconds: 900,
      uploadStatus: 'PENDING_CLIENT_UPLOAD',
      providerUploadId:
        'mock-upload:pending/trips/trip1/flight-ticket/user1/ticket.pdf',
      objectUrl:
        'https://mock-storage.local/object/pending%2Ftrips%2Ftrip1%2Fflight-ticket%2Fuser1%2Fticket.pdf',
      publicUrl: null,
      maxAllowedSizeBytes: 1000,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AbandonmentService, useValue: abandonmentMock },
        { provide: STORAGE_PROVIDER, useValue: storageProviderMock },
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

  it('creates ticket upload intent for draft owner', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({
      id: 'trip1',
      carrierId: 'user1',
      status: 'DRAFT',
    });

    const result = await service.createTicketUploadIntent('user1', 'trip1', {
      fileName: 'ticket.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1000,
    });

    expect(storageProviderMock.prepareUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        storageKey: expect.stringContaining(
          'pending/trips/trip1/flight-ticket/user1/',
        ),
        fileName: 'ticket.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
        kind: 'TRIP_FLIGHT_TICKET',
      }),
    );
    expect(result.provider).toBe('MOCK_STORAGE');
    expect(result.allowedMimeTypes).toContain('application/pdf');
  });

  it('rejects ticket upload intent for unsupported mime type', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({
      id: 'trip1',
      carrierId: 'user1',
      status: 'DRAFT',
    });

    await expect(
      service.createTicketUploadIntent('user1', 'trip1', {
        fileName: 'ticket.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 1000,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(storageProviderMock.prepareUpload).not.toHaveBeenCalled();
  });

  it('submits ticket metadata and refreshes abandonment state', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({
      id: 'trip1',
      carrierId: 'user1',
      status: 'DRAFT',
      flightTicketStatus: 'NOT_PROVIDED',
    });

    prismaMock.trip.update.mockResolvedValue({
      id: 'trip1',
      flightTicketStatus: 'PROVIDED',
      flightTicketFileName: 'ticket.pdf',
    });

    const result = await service.submitTicket('user1', 'trip1', {
      ticketRef: 'AF-ABC123',
      provider: 'MOCK_STORAGE',
      providerUploadId: 'mock-upload:ticket',
      storageKey: 'pending/trips/trip1/flight-ticket/user1/ticket.pdf',
      objectUrl: 'https://mock-storage.local/object/ticket',
      fileName: 'ticket.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1000,
    });

    expect(result.flightTicketStatus).toBe('PROVIDED');
    expect(prismaMock.trip.update).toHaveBeenCalledWith({
      where: { id: 'trip1' },
      data: expect.objectContaining({
        flightTicketStatus: 'PROVIDED',
        flightTicketRef: 'AF-ABC123',
        flightTicketFileName: 'ticket.pdf',
        flightTicketMimeType: 'application/pdf',
        flightTicketSizeBytes: 1000,
        flightTicketProvider: 'MOCK_STORAGE',
        flightTicketProviderUploadId: 'mock-upload:ticket',
        flightTicketStorageKey:
          'pending/trips/trip1/flight-ticket/user1/ticket.pdf',
        flightTicketObjectUrl: 'https://mock-storage.local/object/ticket',
        flightTicketSubmittedById: 'user1',
        flightTicketRejectionReason: null,
        verifiedAt: null,
        verifiedById: null,
      }),
    });
    expect(abandonmentMock.markAbandoned).toHaveBeenCalled();
  });

  it('should throw if trip not found on submitTicket', async () => {
    prismaMock.trip.findUnique.mockResolvedValue(null);

    await expect(
      service.submitTicket('user1', 'missing', {} as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw if submitTicket on another user trip', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({
      id: 'trip1',
      carrierId: 'other-user',
      status: 'DRAFT',
    });

    await expect(
      service.submitTicket('user1', 'trip1', {} as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw if submitTicket when trip is not DRAFT', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({
      id: 'trip1',
      carrierId: 'user1',
      status: 'ACTIVE',
    });

    await expect(
      service.submitTicket('user1', 'trip1', {} as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should verify submitted ticket', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({
      id: 'trip1',
      carrierId: 'user1',
      status: 'DRAFT',
      flightTicketStatus: 'PROVIDED',
    });

    prismaMock.trip.update.mockResolvedValue({
      id: 'trip1',
      flightTicketStatus: 'VERIFIED',
      verifiedById: 'admin1',
    });

    const result = await service.adminVerifyTicket('admin1', 'trip1', {
      decision: AdminVerifyDecision.VERIFIED,
      reviewNotes: 'Readable ticket',
    });

    expect(result.flightTicketStatus).toBe('VERIFIED');
    expect(prismaMock.trip.update).toHaveBeenCalledWith({
      where: { id: 'trip1' },
      data: expect.objectContaining({
        flightTicketStatus: 'VERIFIED',
        verifiedById: 'admin1',
        flightTicketReviewNotes: 'Readable ticket',
        flightTicketRejectionReason: null,
      }),
    });
  });

  it('should reject admin verification if ticket was not submitted first', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({
      id: 'trip1',
      carrierId: 'user1',
      status: 'DRAFT',
      flightTicketStatus: 'NOT_PROVIDED',
    });

    await expect(
      service.adminVerifyTicket('admin1', 'trip1', {
        decision: AdminVerifyDecision.VERIFIED,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should mark abandonment again when admin rejects ticket', async () => {
    prismaMock.trip.findUnique.mockResolvedValue({
      id: 'trip1',
      carrierId: 'user1',
      status: 'DRAFT',
      flightTicketStatus: 'PROVIDED',
    });

    prismaMock.trip.update.mockResolvedValue({
      id: 'trip1',
      flightTicketStatus: 'REJECTED',
      verifiedById: null,
    });

    const result = await service.adminVerifyTicket('admin1', 'trip1', {
      decision: AdminVerifyDecision.REJECTED,
      rejectionReason: 'Unreadable ticket',
    });

    expect(result.flightTicketStatus).toBe('REJECTED');
    expect(prismaMock.trip.update).toHaveBeenCalledWith({
      where: { id: 'trip1' },
      data: expect.objectContaining({
        flightTicketStatus: 'REJECTED',
        verifiedAt: null,
        verifiedById: null,
        flightTicketRejectionReason: 'Unreadable ticket',
      }),
    });
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

    await expect(service.publish('user1', 'trip1')).rejects.toThrow(
      BadRequestException,
    );
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