import { Test, TestingModule } from '@nestjs/testing';
import { ActivityFeedController } from './activity-feed.controller';
import { ActivityFeedService } from './activity-feed.service';
import {
  ActivityFeedSeverity,
  ActivityFeedSourceType,
} from './dto/list-activity-feed-query.dto';

describe('ActivityFeedController', () => {
  let controller: ActivityFeedController;

  const activityFeedServiceMock = {
    listMyFeed: jest.fn(),
    listAdminFeed: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivityFeedController],
      providers: [
        {
          provide: ActivityFeedService,
          useValue: activityFeedServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ActivityFeedController>(ActivityFeedController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates my feed listing to the service', async () => {
    activityFeedServiceMock.listMyFeed.mockResolvedValue({
      items: [{ eventId: 'evt1' }],
      total: 1,
      limit: 10,
      offset: 0,
      hasMore: false,
    });

    const query = {
      sourceType: ActivityFeedSourceType.TRANSACTION,
      severity: ActivityFeedSeverity.INFO,
      q: 'paid',
      limit: 10,
      offset: 0,
    };

    const result = await controller.listMine(
      { user: { userId: 'user1' } },
      query,
    );

    expect(activityFeedServiceMock.listMyFeed).toHaveBeenCalledWith('user1', query);
    expect(result.items).toEqual([{ eventId: 'evt1' }]);
    expect(result.total).toBe(1);
  });

  it('delegates admin feed listing to the service', async () => {
    activityFeedServiceMock.listAdminFeed.mockResolvedValue({
      items: [{ eventId: 'evt2' }],
      total: 1,
      limit: 10,
      offset: 0,
      hasMore: false,
    });

    const query = {
      sourceType: ActivityFeedSourceType.DISPUTE,
      limit: 10,
      offset: 0,
    };

    const result = await controller.listAdmin(query);

    expect(activityFeedServiceMock.listAdminFeed).toHaveBeenCalledWith(query);
    expect(result.items).toEqual([{ eventId: 'evt2' }]);
    expect(result.total).toBe(1);
  });
});