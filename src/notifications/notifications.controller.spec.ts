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
    listOutbox: jest.fn(),
    processDueOutbox: jest.fn(),
    retryOutbox: jest.fn(),
    cancelOutbox: jest.fn(),
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
    notificationsServiceMock.listMyNotifications.mockResolvedValue({
      items: [{ notificationId: 'n1' }],
      total: 1,
      limit: 10,
      offset: 0,
      hasMore: false,
    });

    const query = {
      category: NotificationCategory.TRANSACTION,
      severity: NotificationSeverity.INFO,
      unreadOnly: true,
      q: 'paid',
      limit: 10,
      offset: 0,
    };

    const result = await controller.listMine(
      { user: { userId: 'user1' } },
      query,
    );

    expect(notificationsServiceMock.listMyNotifications).toHaveBeenCalledWith(
      'user1',
      query,
    );
    expect(result.total).toBe(1);
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
    expect(result.isRead).toBe(true);
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
    expect(result.notificationId).toBe('n1');
  });

  it('delegates admin outbox listing to the service', async () => {
    notificationsServiceMock.listOutbox.mockResolvedValue({
      items: [],
      total: 0,
    });

    const result = await controller.listOutbox({
      status: 'PENDING',
      dueOnly: true,
    });

    expect(notificationsServiceMock.listOutbox).toHaveBeenCalledWith({
      status: 'PENDING',
      dueOnly: true,
    });
    expect(result.total).toBe(0);
  });

  it('delegates process due to the service', async () => {
    notificationsServiceMock.processDueOutbox.mockResolvedValue({
      requestedCount: 1,
      successCount: 1,
      failureCount: 0,
      results: [],
    });

    const result = await controller.processDue({ limit: 10 });

    expect(notificationsServiceMock.processDueOutbox).toHaveBeenCalledWith({
      limit: 10,
    });
    expect(result.successCount).toBe(1);
  });

  it('delegates outbox retry to the service', async () => {
    notificationsServiceMock.retryOutbox.mockResolvedValue({
      id: 'outbox1',
      status: 'PENDING',
    });

    const result = await controller.retryOutbox('outbox1');

    expect(notificationsServiceMock.retryOutbox).toHaveBeenCalledWith('outbox1');
    expect(result.status).toBe('PENDING');
  });

  it('delegates outbox cancel to the service', async () => {
    notificationsServiceMock.cancelOutbox.mockResolvedValue({
      id: 'outbox1',
      status: 'CANCELLED',
    });

    const result = await controller.cancelOutbox('outbox1');

    expect(notificationsServiceMock.cancelOutbox).toHaveBeenCalledWith(
      'outbox1',
    );
    expect(result.status).toBe('CANCELLED');
  });
});