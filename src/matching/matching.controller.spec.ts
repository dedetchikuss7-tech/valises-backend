import { Test, TestingModule } from '@nestjs/testing';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';

describe('MatchingController', () => {
  let controller: MatchingController;

  const matchingServiceMock = {
    listTripCandidatesForPackage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchingController],
      providers: [
        {
          provide: MatchingService,
          useValue: matchingServiceMock,
        },
      ],
    }).compile();

    controller = module.get<MatchingController>(MatchingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates trip candidate listing to the service', async () => {
    matchingServiceMock.listTripCandidatesForPackage.mockResolvedValue([
      {
        packageId: 'pkg1',
        travelerId: 'traveler1',
      },
    ]);

    const result = await controller.listTripCandidatesForPackage(
      { user: { userId: 'sender1', role: 'USER' } },
      '11111111-1111-1111-1111-111111111111',
      { limit: 15 },
    );

    expect(matchingServiceMock.listTripCandidatesForPackage).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'sender1',
      'USER',
      15,
    );

    expect(result).toEqual([
      {
        packageId: 'pkg1',
        travelerId: 'traveler1',
      },
    ]);
  });
});