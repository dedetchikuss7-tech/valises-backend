import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { TripController } from './trip.controller';
import { TripService } from './trip.service';
import { AdminVerifyDecision } from './dto/admin-verify-ticket.dto';

describe('TripController', () => {
  let controller: TripController;

  const tripServiceMock = {
    createDraft: jest.fn(),
    findMine: jest.fn(),
    createTicketUploadIntent: jest.fn(),
    submitTicket: jest.fn(),
    publish: jest.fn(),
    adminVerifyTicket: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TripController],
      providers: [{ provide: TripService, useValue: tripServiceMock }],
    }).compile();

    controller = module.get<TripController>(TripController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates createTicketUploadIntent with authenticated user id', async () => {
    const req = { user: { userId: 'user1' } };
    const dto = {
      fileName: 'ticket.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1000,
    };

    tripServiceMock.createTicketUploadIntent.mockResolvedValue({
      tripId: 'trip1',
      provider: 'MOCK_STORAGE',
    });

    const result = await controller.createTicketUploadIntent(req, 'trip1', dto);

    expect(tripServiceMock.createTicketUploadIntent).toHaveBeenCalledWith(
      'user1',
      'trip1',
      dto,
    );
    expect(result.provider).toBe('MOCK_STORAGE');
  });

  it('delegates submitTicket with authenticated user id', async () => {
    const req = { user: { userId: 'user1' } };
    const dto = {
      provider: 'MOCK_STORAGE',
      storageKey: 'pending/trips/trip1/flight-ticket/user1/ticket.pdf',
      fileName: 'ticket.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1000,
    };

    tripServiceMock.submitTicket.mockResolvedValue({
      id: 'trip1',
      flightTicketStatus: 'PROVIDED',
    });

    const result = await controller.submitTicket(req, 'trip1', dto);

    expect(tripServiceMock.submitTicket).toHaveBeenCalledWith(
      'user1',
      'trip1',
      dto,
    );
    expect(result.flightTicketStatus).toBe('PROVIDED');
  });

  it('delegates adminVerify with authenticated admin id and full dto', async () => {
    const req = { user: { userId: 'admin1' } };
    const dto = {
      decision: AdminVerifyDecision.REJECTED,
      rejectionReason: 'Unreadable ticket',
      reviewNotes: 'Please resubmit',
    };

    tripServiceMock.adminVerifyTicket.mockResolvedValue({
      id: 'trip1',
      flightTicketStatus: 'REJECTED',
    });

    const result = await controller.adminVerify(req, 'trip1', dto);

    expect(tripServiceMock.adminVerifyTicket).toHaveBeenCalledWith(
      'admin1',
      'trip1',
      dto,
    );
    expect(result.flightTicketStatus).toBe('REJECTED');
  });

  it('throws UnauthorizedException when auth user id is missing', () => {
    const req = { user: {} };

    expect(() => controller.myTrips(req)).toThrow(UnauthorizedException);
  });
});