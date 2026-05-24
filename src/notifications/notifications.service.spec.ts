import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import {
  NotificationCategory,
  NotificationSeverity,
} from './dto/list-my-notifications-query.dto';
import { NotificationsProvider } from './providers/notifications.provider';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const prismaMock = {
    adminActionAudit: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    user: {
      findUnique: jest.fn(),
    },
  };

  const notificationsProviderMock: jest.Mocked<NotificationsProvider> = {
    sendEmail: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(
      prismaMock as any,
      notificationsProviderMock,
    );
  });

  it('lists user notifications with read state in paginated format', async () => {
    prismaMock.adminActionAudit.findMany
      .mockResolvedValueOnce([
        emitAuditRow({
          targetId: 'notif1',
          recipientUserId: 'user1',
          category: 'TRANSACTION',
          severity: 'INFO',
          title: 'Transaction updated',
          message: 'Your transaction moved to PAID',
          contextType: 'TRANSACTION',
          contextId: 'tx1',
          metadataSummary: 'paid',
        }),
      ])
      .mockResolvedValueOnce([
        {
          targetId: 'notif1',
          createdAt: new Date('2099-01-01T01:00:00.000Z'),
        },
      ]);

    const result = await service.listMyNotifications('user1', {
      unreadOnly: false,
      q: 'paid',
      limit: 20,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].notificationId).toBe('notif1');
    expect(result.items[0].isRead).toBe(true);
  });

  it('emits a notification and enqueues an outbox row', async () => {
    prismaMock.adminActionAudit.create.mockResolvedValue({ id: 'audit1' });

    prismaMock.$queryRaw.mockResolvedValueOnce([
      outboxRow({
        id: 'outbox1',
        recipient_user_id: 'user2',
        channel: 'IN_APP',
        status: 'PENDING',
      }),
    ]);

    prismaMock.adminActionAudit.findMany
      .mockResolvedValueOnce([
        emitAuditRow({
          targetId: 'notif-123',
          recipientUserId: 'user2',
          category: 'SYSTEM',
          severity: 'WARNING',
          title: 'System update',
          message: 'Please review your case',
        }),
      ])
      .mockResolvedValueOnce([]);

    const randomUUIDSpy = jest
      .spyOn(require('crypto'), 'randomUUID')
      .mockReturnValueOnce('notif-123')
      .mockReturnValueOnce('outbox1');

    const result = await service.emitNotification('admin1', {
      recipientUserId: 'user2',
      recipientRole: 'USER',
      category: NotificationCategory.SYSTEM,
      severity: NotificationSeverity.WARNING,
      title: 'System update',
      message: 'Please review your case',
    });

    expect(prismaMock.adminActionAudit.create).toHaveBeenCalled();
    expect(prismaMock.$queryRaw).toHaveBeenCalled();
    expect(result.notificationId).toBe('notif-123');

    randomUUIDSpy.mockRestore();
  });

  it('acknowledges one unread notification', async () => {
    prismaMock.adminActionAudit.findMany
      .mockResolvedValueOnce([
        emitAuditRow({
          targetId: 'notif1',
          recipientUserId: 'user1',
          category: 'SYSTEM',
          severity: 'INFO',
          title: 'Hello',
          message: 'World',
        }),
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        emitAuditRow({
          targetId: 'notif1',
          recipientUserId: 'user1',
          category: 'SYSTEM',
          severity: 'INFO',
          title: 'Hello',
          message: 'World',
        }),
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
        emitAuditRow({
          targetId: 'notif1',
          recipientUserId: 'user2',
          category: 'SYSTEM',
          severity: 'INFO',
          title: 'Hello',
          message: 'World',
        }),
      ])
      .mockResolvedValueOnce([]);

    await expect(
      service.acknowledgeNotification('notif1', 'user1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists admin outbox rows', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([outboxRow({ id: 'outbox1' })])
      .mockResolvedValueOnce([{ count: BigInt(1) }]);

    const result = await service.listOutbox({
      status: 'PENDING',
      dueOnly: true,
      limit: 50,
      offset: 0,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('outbox1');
    expect(result.total).toBe(1);
  });

  it('processes due outbox rows by marking them as sent', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([outboxRow({ id: 'outbox1' })])
      .mockResolvedValueOnce([
        outboxRow({
          id: 'outbox1',
          status: 'SENT',
          sent_at: new Date('2099-01-01T01:00:00.000Z'),
          attempt_count: 1,
        }),
      ]);

    const result = await service.processDueOutbox({ limit: 10 });

    expect(result.requestedCount).toBe(1);
    expect(result.successCount).toBe(1);
    expect(result.results[0]).toEqual({
      itemId: 'outbox1',
      success: true,
      message: 'SENT',
    });
  });

  it('retries failed outbox rows', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([outboxRow({ id: 'outbox1', status: 'FAILED' })])
      .mockResolvedValueOnce([outboxRow({ id: 'outbox1', status: 'PENDING' })]);

    const result = await service.retryOutbox('outbox1');

    expect(result.status).toBe('PENDING');
  });

  it('rejects retry for pending outbox rows', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      outboxRow({ id: 'outbox1', status: 'PENDING' }),
    ]);

    await expect(service.retryOutbox('outbox1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('cancels pending outbox rows', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([outboxRow({ id: 'outbox1', status: 'PENDING' })])
      .mockResolvedValueOnce([
        outboxRow({ id: 'outbox1', status: 'CANCELLED' }),
      ]);

    const result = await service.cancelOutbox('outbox1');

    expect(result.status).toBe('CANCELLED');
  });

  it('processDueOutbox with EMAIL row calls provider.sendEmail()', async () => {
    notificationsProviderMock.sendEmail.mockResolvedValueOnce({
      success: true,
      providerMessageId: 'msg-001',
      sentAt: new Date().toISOString(),
    });

    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        outboxRow({
          id: 'outbox-email',
          channel: 'EMAIL',
          recipient_user_id: 'user-abc',
          payload: { title: 'Hello', message: 'World' },
        }),
      ])
      .mockResolvedValueOnce([
        outboxRow({ id: 'outbox-email', status: 'SENT', attempt_count: 1 }),
      ]);

    prismaMock.user.findUnique.mockResolvedValueOnce({
      email: 'user@example.com',
    });

    const result = await service.processDueOutbox({ limit: 10 });

    expect(notificationsProviderMock.sendEmail).toHaveBeenCalledTimes(1);
    expect(notificationsProviderMock.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: 'user@example.com' }),
    );
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(0);
  });

  it('processDueOutbox with IN_APP row does NOT call provider.sendEmail()', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        outboxRow({ id: 'outbox-inapp', channel: 'IN_APP' }),
      ])
      .mockResolvedValueOnce([
        outboxRow({ id: 'outbox-inapp', status: 'SENT', attempt_count: 1 }),
      ]);

    const result = await service.processDueOutbox({ limit: 10 });

    expect(notificationsProviderMock.sendEmail).not.toHaveBeenCalled();
    expect(result.successCount).toBe(1);
  });
});

function emitAuditRow(input: {
  targetId: string;
  recipientUserId: string;
  category: string;
  severity: string;
  title: string;
  message: string;
  contextType?: string | null;
  contextId?: string | null;
  metadataSummary?: string | null;
}) {
  return {
    targetId: input.targetId,
    metadata: {
      notificationId: input.targetId,
      recipientUserId: input.recipientUserId,
      recipientRole: 'USER',
      category: input.category,
      severity: input.severity,
      title: input.title,
      message: input.message,
      contextType: input.contextType ?? null,
      contextId: input.contextId ?? null,
      metadataSummary: input.metadataSummary ?? null,
      createdAt: '2099-01-01T00:00:00.000Z',
    },
    createdAt: new Date('2099-01-01T00:00:00.000Z'),
  };
}

function outboxRow(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date('2099-01-01T00:00:00.000Z');

  return {
    id: 'outbox1',
    recipient_user_id: null,
    channel: 'IN_APP',
    status: 'PENDING',
    template_key: 'SYSTEM',
    event_type: 'notification.system',
    target_type: null,
    target_id: null,
    payload: {},
    metadata: null,
    scheduled_for: now,
    sent_at: null,
    failed_at: null,
    cancelled_at: null,
    failure_reason: null,
    attempt_count: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}