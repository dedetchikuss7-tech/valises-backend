import { Test, TestingModule } from '@nestjs/testing';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import {
  MatchSortOrder,
  MatchTripCandidatesSortBy,
} from './dto/list-package-trip-candidates-query.dto';

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

  it('delegates trip candidate listing to the service with full query object', async () => {
    matchingServiceMock.listTripCandidatesForPackage.mockResolvedValue([
      {
        packageId: 'pkg1',
        travelerId: 'traveler1',
      },
    ]);

    const query = {
      limit: 15,
      minTravelerTrustScore: 70,
      verifiedOnly: true,
      withAvailableCapacityOnly: true,
      excludeRestricted: true,
      sortBy: MatchTripCandidatesSortBy.TRAVELER_TRUST_SCORE,
      sortOrder: MatchSortOrder.DESC,
    };

    const result = await controller.listTripCandidatesForPackage(
      { user: { userId: 'sender1', role: 'USER' } },
      '11111111-1111-1111-1111-111111111111',
      query,
    );

    expect(matchingServiceMock.listTripCandidatesForPackage).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'sender1',
      'USER',
      query,
    );

    expect(result).toEqual([
      {
        packageId: 'pkg1',
        travelerId: 'traveler1',
      },
    ]);
  });
});