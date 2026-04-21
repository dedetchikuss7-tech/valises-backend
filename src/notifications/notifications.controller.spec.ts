import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import {
  NotificationCategory,
  NotificationSeverity,
} from './dto/list-my-notifications-query.dto';

describe('NotificationsController', () => {
  let controller: NotificationsController;

  const notificationsServiceMock = {
    listMyNotifications: jest.fn(),
    acknowledgeNotification: jest.fn(),
    emitNotification: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: notificationsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates listing to the service', async () => {
    notificationsServiceMock.listMyNotifications.mockResolvedValue([
      { notificationId: 'n1' },
    ]);

    const query = {
      category: NotificationCategory.TRANSACTION,
      severity: NotificationSeverity.INFO,
      unreadOnly: true,
      limit: 10,
    };

    const result = await controller.listMine(
      { user: { userId: 'user1' } },
      query,
    );

    expect(notificationsServiceMock.listMyNotifications).toHaveBeenCalledWith(
      'user1',
      query,
    );
    expect(result).toEqual([{ notificationId: 'n1' }]);
  });

  it('delegates acknowledge to the service', async () => {
    notificationsServiceMock.acknowledgeNotification.mockResolvedValue({
      notificationId: 'n1',
      isRead: true,
    });

    const result = await controller.acknowledge(
      { user: { userId: 'user1' } },
      'n1',
    );

    expect(
      notificationsServiceMock.acknowledgeNotification,
    ).toHaveBeenCalledWith('n1', 'user1');
    expect(result).toEqual({
      notificationId: 'n1',
      isRead: true,
    });
  });

  it('delegates emission to the service', async () => {
    notificationsServiceMock.emitNotification.mockResolvedValue({
      notificationId: 'n1',
      recipientUserId: 'user2',
    });

    const dto = {
      recipientUserId: 'user2',
      category: NotificationCategory.SYSTEM,
      severity: NotificationSeverity.WARNING,
      title: 'System update',
      message: 'Please review your case',
    };

    const result = await controller.emit(
      { user: { userId: 'admin1' } },
      dto,
    );

    expect(notificationsServiceMock.emitNotification).toHaveBeenCalledWith(
      'admin1',
      dto,
    );
    expect(result).toEqual({
      notificationId: 'n1',
      recipientUserId: 'user2',
    });
  });
});