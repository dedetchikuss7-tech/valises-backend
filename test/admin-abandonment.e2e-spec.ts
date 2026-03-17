import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import {
  AbandonmentEventStatus,
  AbandonmentKind,
  ReminderChannel,
  Role,
} from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type SeedUser = {
  id: string;
  email: string;
  role: Role;
  token: string;
};

describe('Admin Abandonment (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let admin: SeedUser;
  let regularUser: SeedUser;

  const jwtSecret = process.env.JWT_SECRET ?? 'dev_jwt_secret';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase();

    admin = await createUserWithToken('admin-abandonment@valises.test', Role.ADMIN);
    regularUser = await createUserWithToken('user-abandonment@valises.test', Role.USER);
  });

  async function cleanDatabase() {
    await prisma.messageModerationEvent.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();

    await prisma.reminderJob.deleteMany();
    await prisma.abandonmentEvent.deleteMany();

    await prisma.payout.deleteMany();
    await prisma.refund.deleteMany();

    await prisma.ledgerEntry.deleteMany();

    await prisma.disputeResolution.deleteMany();
    await prisma.dispute.deleteMany();

    await prisma.transaction.deleteMany();
    await prisma.package.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.corridor.deleteMany();

    await prisma.user.deleteMany();
  }

  async function createUserWithToken(email: string, role: Role): Promise<SeedUser> {
    const passwordHash = await bcrypt.hash('Password123!', 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role,
        kycStatus: 'VERIFIED',
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    const token = jwt.sign(
      {
        sub: user.id,
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: '1h' },
    );

    return {
      ...user,
      token,
    };
  }

  async function createAbandonmentEvent(params?: {
    userId?: string;
    kind?: AbandonmentKind;
    status?: AbandonmentEventStatus;
  }) {
    return prisma.abandonmentEvent.create({
      data: {
        userId: params?.userId ?? regularUser.id,
        kind: params?.kind ?? AbandonmentKind.TRIP_DRAFT,
        status: params?.status ?? AbandonmentEventStatus.ACTIVE,
        metadata: {},
      },
    });
  }

  it('admin can create one reminder job from one active abandonment event', async () => {
    const event = await createAbandonmentEvent({
      kind: AbandonmentKind.TRIP_DRAFT,
      status: AbandonmentEventStatus.ACTIVE,
    });

    const scheduledFor = '2026-03-18T09:00:00.000Z';

    const res = await request(app.getHttpServer())
      .post(`/admin/abandonment-events/${event.id}/reminder-jobs`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        channel: ReminderChannel.EMAIL,
        scheduledFor,
        payload: {
          templateKey: 'abandonment_followup_manual',
          note: 'Created in e2e',
        },
      })
      .expect(201);

    expect(res.body.action).toBe('CREATED');
    expect(res.body.item.abandonmentEventId).toBe(event.id);
    expect(res.body.item.channel).toBe(ReminderChannel.EMAIL);
    expect(res.body.item.status).toBe('PENDING');

    const reminderJobs = await prisma.reminderJob.findMany({
      where: {
        abandonmentEventId: event.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    expect(reminderJobs).toHaveLength(1);
    expect(reminderJobs[0].abandonmentEventId).toBe(event.id);
    expect(reminderJobs[0].channel).toBe(ReminderChannel.EMAIL);
    expect(reminderJobs[0].status).toBe('PENDING');
  });

  it('admin gets conflict when exact pending duplicate reminder job already exists', async () => {
    const event = await createAbandonmentEvent({
      kind: AbandonmentKind.TRIP_DRAFT,
      status: AbandonmentEventStatus.ACTIVE,
    });

    const scheduledFor = '2026-03-18T09:00:00.000Z';

    await request(app.getHttpServer())
      .post(`/admin/abandonment-events/${event.id}/reminder-jobs`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        channel: ReminderChannel.EMAIL,
        scheduledFor,
        payload: {
          templateKey: 'abandonment_followup_manual',
        },
      })
      .expect(201);

    const duplicateRes = await request(app.getHttpServer())
      .post(`/admin/abandonment-events/${event.id}/reminder-jobs`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        channel: ReminderChannel.EMAIL,
        scheduledFor,
        payload: {
          templateKey: 'abandonment_followup_manual',
        },
      })
      .expect(409);

    expect(duplicateRes.body.message).toContain(
      'A pending reminder job with the same event, channel, and scheduled time already exists',
    );

    const reminderJobs = await prisma.reminderJob.findMany({
      where: {
        abandonmentEventId: event.id,
      },
    });

    expect(reminderJobs).toHaveLength(1);
  });

  it('admin can create reminder jobs in batch with created and skipped results', async () => {
    const activeEvent = await createAbandonmentEvent({
      kind: AbandonmentKind.TRIP_DRAFT,
      status: AbandonmentEventStatus.ACTIVE,
    });

    const inactiveEvent = await createAbandonmentEvent({
      kind: AbandonmentKind.KYC_PENDING,
      status: AbandonmentEventStatus.RESOLVED,
    });

    const missingEventId = '11111111-1111-4111-8111-111111111111';
    const scheduledFor = '2026-03-19T10:00:00.000Z';

    const res = await request(app.getHttpServer())
      .post('/admin/abandonment-events/reminder-jobs')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        eventIds: [
          activeEvent.id,
          inactiveEvent.id,
          missingEventId,
          activeEvent.id,
        ],
        channel: ReminderChannel.EMAIL,
        scheduledFor,
        payload: {
          templateKey: 'abandonment_followup_manual_batch',
          note: 'Created in batch e2e',
        },
      })
      .expect(201);

    expect(res.body.action).toBe('CREATED_BATCH');
    expect(res.body.requestedCount).toBe(4);
    expect(res.body.uniqueEventIdsCount).toBe(3);
    expect(res.body.createdCount).toBe(1);
    expect(res.body.skippedCount).toBe(2);

    expect(res.body.created).toEqual([
      expect.objectContaining({
        abandonmentEventId: activeEvent.id,
        status: 'PENDING',
      }),
    ]);

    expect(res.body.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          abandonmentEventId: inactiveEvent.id,
          reason: 'ABANDONMENT_EVENT_NOT_ACTIVE',
        }),
        expect.objectContaining({
          abandonmentEventId: missingEventId,
          reason: 'ABANDONMENT_EVENT_NOT_FOUND',
        }),
      ]),
    );

    const activeEventJobs = await prisma.reminderJob.findMany({
      where: {
        abandonmentEventId: activeEvent.id,
      },
    });

    const inactiveEventJobs = await prisma.reminderJob.findMany({
      where: {
        abandonmentEventId: inactiveEvent.id,
      },
    });

    expect(activeEventJobs).toHaveLength(1);
    expect(inactiveEventJobs).toHaveLength(0);
  });

  it('non-admin cannot create reminder job from abandonment event', async () => {
    const event = await createAbandonmentEvent({
      kind: AbandonmentKind.TRIP_DRAFT,
      status: AbandonmentEventStatus.ACTIVE,
    });

    await request(app.getHttpServer())
      .post(`/admin/abandonment-events/${event.id}/reminder-jobs`)
      .set('Authorization', `Bearer ${regularUser.token}`)
      .send({
        channel: ReminderChannel.EMAIL,
        scheduledFor: '2026-03-18T09:00:00.000Z',
        payload: {
          templateKey: 'abandonment_followup_manual',
        },
      })
      .expect(403);
  });
});