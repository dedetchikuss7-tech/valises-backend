import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import {
  NotificationCategory,
  NotificationSeverity,
} from './dto/list-my-notifications-query.dto';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const prismaMock = {
    adminActionAudit: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(prismaMock as any);
  });

  it('lists user notifications with read state', async () => {
    prismaMock.adminActionAudit.findMany
      .mockResolvedValueOnce([
        {
          targetId: 'notif1',
          metadata: {
            notificationId: 'notif1',
            recipientUserId: 'user1',
            recipientRole: 'USER',
            category: 'TRANSACTION',
            severity: 'INFO',
            title: 'Transaction updated',
            message: 'Your transaction moved to PAID',
            contextType: 'TRANSACTION',
            contextId: 'tx1',
            metadataSummary: 'paid',
            createdAt: '2099-01-01T00:00:00.000Z',
          },
          createdAt: new Date('2099-01-01T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          targetId: 'notif1',
          createdAt: new Date('2099-01-01T01:00:00.000Z'),
        },
      ]);

    const result = await service.listMyNotifications('user1', {
      unreadOnly: false,
      limit: 20,
    });

    expect(result).toHaveLength(1);
    expect(result[0].notificationId).toBe('notif1');
    expect(result[0].isRead).toBe(true);
  });

  it('emits a notification and returns it for the recipient', async () => {
    prismaMock.adminActionAudit.create.mockResolvedValue({ id: 'audit1' });

    prismaMock.adminActionAudit.findMany
      .mockResolvedValueOnce([
        {
          targetId: 'notif-123',
          metadata: {
            notificationId: 'notif-123',
            recipientUserId: 'user2',
            recipientRole: 'USER',
            category: 'SYSTEM',
            severity: 'WARNING',
            title: 'System update',
            message: 'Please review your case',
            contextType: null,
            contextId: null,
            metadataSummary: null,
            createdAt: '2099-01-01T00:00:00.000Z',
          },
          createdAt: new Date('2099-01-01T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([]);

    jest
      .spyOn(global.Math, 'random')
      .mockReturnValue(0.123456789);

    const randomUUIDSpy = jest
      .spyOn(require('crypto'), 'randomUUID')
      .mockReturnValue('notif-123');

    const result = await service.emitNotification('admin1', {
      recipientUserId: 'user2',
      recipientRole: 'USER',
      category: NotificationCategory.SYSTEM,
      severity: NotificationSeverity.WARNING,
      title: 'System update',
      message: 'Please review your case',
    });

    expect(prismaMock.adminActionAudit.create).toHaveBeenCalled();
    expect(result.notificationId).toBe('notif-123');

    randomUUIDSpy.mockRestore();
    (Math.random as any).mockRestore?.();
  });

  it('acknowledges one unread notification', async () => {
    prismaMock.adminActionAudit.findMany
      .mockResolvedValueOnce([
        {
          targetId: 'notif1',
          metadata: {
            notificationId: 'notif1',
            recipientUserId: 'user1',
            recipientRole: 'USER',
            category: 'SYSTEM',
            severity: 'INFO',
            title: 'Hello',
            message: 'World',
            contextType: null,
            contextId: null,
            metadataSummary: null,
            createdAt: '2099-01-01T00:00:00.000Z',
          },
          createdAt: new Date('2099-01-01T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          targetId: 'notif1',
          metadata: {
            notificationId: 'notif1',
            recipientUserId: 'user1',
            recipientRole: 'USER',
            category: 'SYSTEM',
            severity: 'INFO',
            title: 'Hello',
            message: 'World',
            contextType: null,
            contextId: null,
            metadataSummary: null,
            createdAt: '2099-01-01T00:00:00.000Z',
          },
          createdAt: new Date('2099-01-01T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          targetId: 'notif1',
          createdAt: new Date('2099-01-01T01:00:00.000Z'),
        },
      ]);

    prismaMock.adminActionAudit.create.mockResolvedValue({ id: 'ack1' });

    const result = await service.acknowledgeNotification('notif1', 'user1');

    expect(prismaMock.adminActionAudit.create).toHaveBeenCalled();
    expect(result.isRead).toBe(true);
  });

  it('throws when acknowledging a notification not owned by the user', async () => {
    prismaMock.adminActionAudit.findMany
      .mockResolvedValueOnce([
        {
          targetId: 'notif1',
          metadata: {
            notificationId: 'notif1',
            recipientUserId: 'user2',
            recipientRole: 'USER',
            category: 'SYSTEM',
            severity: 'INFO',
            title: 'Hello',
            message: 'World',
            contextType: null,
            contextId: null,
            metadataSummary: null,
            createdAt: '2099-01-01T00:00:00.000Z',
          },
          createdAt: new Date('2099-01-01T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([]);

    await expect(
      service.acknowledgeNotification('notif1', 'user1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});