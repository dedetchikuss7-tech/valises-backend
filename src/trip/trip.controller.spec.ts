import { Test, TestingModule } from '@nestjs/testing';
import { TripController } from './trip.controller';
import { TripService } from './trip.service';

describe('TripController', () => {
  let controller: TripController;

  const tripServiceMock = {
    createDraft: jest.fn(),
    findMine: jest.fn(),
    submitTicket: jest.fn(),
    publish: jest.fn(),
    adminVerifyTicket: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TripController],
      providers: [{ provide: TripService, useValue: tripServiceMock }],
    }).compile();

    controller = module.get<TripController>(TripController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});