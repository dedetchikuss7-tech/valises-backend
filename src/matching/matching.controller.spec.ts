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
    shortlistTripForPackage: jest.fn(),
    removeShortlistedTripForPackage: jest.fn(),
    listShortlistForPackage: jest.fn(),
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
      shortlistedOnly: false,
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

  it('delegates shortlist creation/update to the service', async () => {
    matchingServiceMock.shortlistTripForPackage.mockResolvedValue({
      id: 'short1',
      packageId: 'pkg1',
      tripId: 'trip1',
    });

    const result = await controller.shortlistTripForPackage(
      { user: { userId: 'sender1', role: 'USER' } },
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      {
        priorityRank: 5,
        note: 'Strong option',
        isVisible: true,
      },
    );

    expect(matchingServiceMock.shortlistTripForPackage).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      'sender1',
      'USER',
      {
        priorityRank: 5,
        note: 'Strong option',
        isVisible: true,
      },
    );

    expect(result).toEqual({
      id: 'short1',
      packageId: 'pkg1',
      tripId: 'trip1',
    });
  });

  it('delegates shortlist removal to the service', async () => {
    matchingServiceMock.removeShortlistedTripForPackage.mockResolvedValue({
      packageId: 'pkg1',
      tripId: 'trip1',
      removed: true,
    });

    const result = await controller.removeShortlistedTripForPackage(
      { user: { userId: 'sender1', role: 'USER' } },
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
    );

    expect(
      matchingServiceMock.removeShortlistedTripForPackage,
    ).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      'sender1',
      'USER',
    );

    expect(result).toEqual({
      packageId: 'pkg1',
      tripId: 'trip1',
      removed: true,
    });
  });

  it('delegates shortlist listing to the service', async () => {
    matchingServiceMock.listShortlistForPackage.mockResolvedValue([
      {
        id: 'short1',
        packageId: 'pkg1',
      },
    ]);

    const result = await controller.listShortlistForPackage(
      { user: { userId: 'sender1', role: 'USER' } },
      '11111111-1111-1111-1111-111111111111',
    );

    expect(matchingServiceMock.listShortlistForPackage).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'sender1',
      'USER',
    );

    expect(result).toEqual([
      {
        id: 'short1',
        packageId: 'pkg1',
      },
    ]);
  });
});