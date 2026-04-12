import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import {
  AbandonmentEventStatus,
  AbandonmentKind,
  DisputeOpeningSource,
  DisputeReasonCode,
  DisputeStatus,
  PaymentStatus,
  RefundProvider,
  RefundStatus,
  ReminderChannel,
  ReminderJobStatus,
  Role,
  TransactionStatus,
} from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type SeedUser = {
  id: string;
  email: string;
  role: Role;
  token: string;
};

describe('Admin dashboard summary (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let admin: SeedUser;
  let sender: SeedUser;
  let traveler: SeedUser;

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

    admin = await createUserWithToken('admin-dashboard@valises.test', Role.ADMIN);
    sender = await createUserWithToken('sender-dashboard@valises.test', Role.USER);
    traveler = await createUserWithToken(
      'traveler-dashboard@valises.test',
      Role.USER,
    );
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

    await prisma.disputeEvidenceItem.deleteMany();
    await prisma.disputeCaseNote.deleteMany();
    await prisma.disputeResolution.deleteMany();
    await prisma.dispute.deleteMany();

    await prisma.transaction.deleteMany();
    await prisma.package.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.corridorPricingPaymentConfig.deleteMany();
    await prisma.corridor.deleteMany();

    await prisma.adminActionAudit.deleteMany();
    await prisma.user.deleteMany();
  }

  async function createUserWithToken(
    email: string,
    role: Role,
  ): Promise<SeedUser> {
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

  async function createTransaction(
    status: TransactionStatus,
    amount = 1000,
  ) {
    return prisma.transaction.create({
      data: {
        senderId: sender.id,
        travelerId: traveler.id,
        amount,
        commission: 0,
        escrowAmount: amount,
        status,
        paymentStatus: PaymentStatus.SUCCESS,
        currency: 'XAF',
      },
    });
  }

  async function seedAttentionData() {
    const tx1 = await createTransaction(TransactionStatus.DISPUTED, 1000);
    const tx2 = await createTransaction(TransactionStatus.DELIVERED, 900);
    const tx3 = await createTransaction(TransactionStatus.CANCELLED, 800);

    const dispute = await prisma.dispute.create({
      data: {
        transactionId: tx1.id,
        openedById: sender.id,
        reason: 'Not delivered',
        reasonCode: DisputeReasonCode.NOT_DELIVERED,
        openingSource: DisputeOpeningSource.MANUAL,
        initiatedBySide: 'SENDER',
        triggeredByRole: 'USER',
        status: DisputeStatus.OPEN,
      },
    });

    const payout = await prisma.payout.create({
      data: {
        transactionId: tx2.id,
        provider: 'MANUAL',
        status: 'REQUESTED',
        amount: 900,
        currency: 'XAF',
        idempotencyKey: `po:${tx2.id}`,
      },
    });

    const refund = await prisma.refund.create({
      data: {
        transactionId: tx3.id,
        provider: RefundProvider.MANUAL,
        status: RefundStatus.PROCESSING,
        amount: 800,
        currency: 'XAF',
        idempotencyKey: `rf:${tx3.id}`,
      },
    });

    const event = await prisma.abandonmentEvent.create({
      data: {
        userId: sender.id,
        kind: AbandonmentKind.KYC_PENDING,
        status: AbandonmentEventStatus.ACTIVE,
      },
    });

    const reminderJob = await prisma.reminderJob.create({
      data: {
        abandonmentEventId: event.id,
        channel: ReminderChannel.EMAIL,
        status: ReminderJobStatus.PENDING,
        scheduledFor: new Date(Date.now() - 60_000),
      },
    });

    return { tx1, tx2, tx3, dispute, payout, refund, event, reminderJob };
  }

  it('returns consolidated admin dashboard summary', async () => {
    const { tx1, tx2, tx3 } = await seedAttentionData();

    const res = await request(app.getHttpServer())
      .get('/admin/dashboard/summary?previewLimit=5')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(res.body.previewLimit).toBe(5);
    expect(res.body.counts.transactionsRequiringAttentionCount).toBe(3);

    const txPreviewIds = res.body.transactionsRequiringAttentionPreview.map(
      (item: any) => item.transactionId,
    );

    expect(txPreviewIds).toEqual(
      expect.arrayContaining([tx1.id, tx2.id, tx3.id]),
    );
  });

  it('returns paginated activity feed', async () => {
    await seedAttentionData();

    await prisma.adminActionAudit.createMany({
      data: [
        {
          action: 'DISPUTE_RESOLVED',
          targetType: 'DISPUTE',
          targetId: 'dp-1',
          actorUserId: admin.id,
          metadata: { transactionId: 'tx-1' } as any,
        },
        {
          action: 'PAYOUT_MARKED_PAID',
          targetType: 'PAYOUT',
          targetId: 'po-1',
          actorUserId: admin.id,
          metadata: { transactionId: 'tx-2' } as any,
        },
      ],
    });

    const res = await request(app.getHttpServer())
      .get('/admin/dashboard/activity?limit=1&offset=0&action=DISPUTE_RESOLVED')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].action).toBe('DISPUTE_RESOLVED');
  });

  it('returns paginated transaction attention queue', async () => {
    await seedAttentionData();

    const res = await request(app.getHttpServer())
      .get(
        '/admin/dashboard/queues/transactions-requiring-attention?limit=1&offset=0&hasOpenDispute=true',
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].hasOpenDispute).toBe(true);
  });

  it('returns filtered open disputes queue', async () => {
    await seedAttentionData();

    const res = await request(app.getHttpServer())
      .get(
        '/admin/dashboard/queues/open-disputes?limit=10&offset=0&reasonCode=NOT_DELIVERED',
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.items[0].reasonCode).toBe('NOT_DELIVERED');
  });

  it('returns filtered pending payouts queue', async () => {
    await seedAttentionData();

    const res = await request(app.getHttpServer())
      .get(
        '/admin/dashboard/queues/pending-payouts?limit=10&offset=0&currency=XAF',
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.items[0].currency).toBe('XAF');
  });

  it('returns filtered pending refunds queue', async () => {
    await seedAttentionData();

    const res = await request(app.getHttpServer())
      .get(
        '/admin/dashboard/queues/pending-refunds?limit=10&offset=0&currency=XAF',
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.items[0].currency).toBe('XAF');
  });

  it('returns paginated actionable reminder jobs queue', async () => {
    await seedAttentionData();

    const res = await request(app.getHttpServer())
      .get(
        '/admin/dashboard/queues/actionable-reminder-jobs?limit=1&offset=0&status=PENDING&channel=EMAIL',
      )
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].channel).toBe('EMAIL');
  });

  it('bulk triggers reminder jobs', async () => {
    const { reminderJob } = await seedAttentionData();

    const res = await request(app.getHttpServer())
      .post('/admin/dashboard/actions/reminder-jobs/trigger-many')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ids: [reminderJob.id] })
      .expect(201);

    expect(res.body.requestedCount).toBe(1);
    expect(res.body.successCount).toBe(1);
  });

  it('bulk cancels reminder jobs', async () => {
    const { reminderJob } = await seedAttentionData();

    const res = await request(app.getHttpServer())
      .post('/admin/dashboard/actions/reminder-jobs/cancel-many')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ids: [reminderJob.id] })
      .expect(201);

    expect(res.body.requestedCount).toBe(1);
    expect(res.body.successCount).toBe(1);
  });

  it('bulk retries reminder jobs', async () => {
    const { reminderJob } = await seedAttentionData();

    await prisma.reminderJob.update({
      where: { id: reminderJob.id },
      data: {
        status: ReminderJobStatus.CANCELLED,
      },
    });

    const res = await request(app.getHttpServer())
      .post('/admin/dashboard/actions/reminder-jobs/retry-many')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ ids: [reminderJob.id] })
      .expect(201);

    expect(res.body.requestedCount).toBe(1);
    expect(res.body.successCount).toBe(1);
  });

  it('rejects non-admin access', async () => {
    await request(app.getHttpServer())
      .get('/admin/dashboard/summary')
      .set('Authorization', `Bearer ${sender.token}`)
      .expect(403);
  });
});