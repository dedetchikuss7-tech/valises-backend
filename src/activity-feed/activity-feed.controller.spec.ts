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
    activityFeedServiceMock.listMyFeed.mockResolvedValue([{ eventId: 'evt1' }]);

    const query = {
      sourceType: ActivityFeedSourceType.TRANSACTION,
      severity: ActivityFeedSeverity.INFO,
      limit: 10,
    };

    const result = await controller.listMine(
      { user: { userId: 'user1' } },
      query,
    );

    expect(activityFeedServiceMock.listMyFeed).toHaveBeenCalledWith('user1', query);
    expect(result).toEqual([{ eventId: 'evt1' }]);
  });

  it('delegates admin feed listing to the service', async () => {
    activityFeedServiceMock.listAdminFeed.mockResolvedValue([{ eventId: 'evt2' }]);

    const query = {
      sourceType: ActivityFeedSourceType.DISPUTE,
      limit: 10,
    };

    const result = await controller.listAdmin(query);

    expect(activityFeedServiceMock.listAdminFeed).toHaveBeenCalledWith(query);
    expect(result).toEqual([{ eventId: 'evt2' }]);
  });
});