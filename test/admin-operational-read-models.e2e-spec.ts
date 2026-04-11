import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import {
  DisputeOpeningSource,
  DisputeReasonCode,
  DisputeStatus,
  PaymentStatus,
  RefundProvider,
  RefundStatus,
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

describe('Admin operational read models (e2e)', () => {
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

    admin = await createUserWithToken('admin-ops@valises.test', Role.ADMIN);
    sender = await createUserWithToken('sender-ops@valises.test', Role.USER);
    traveler = await createUserWithToken(
      'traveler-ops@valises.test',
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

  async function createTransactionWithEscrow(amount = 1000) {
    return prisma.transaction.create({
      data: {
        senderId: sender.id,
        travelerId: traveler.id,
        amount,
        commission: 0,
        escrowAmount: amount,
        status: TransactionStatus.DISPUTED,
        paymentStatus: PaymentStatus.SUCCESS,
        currency: 'XAF',
      },
    });
  }

  it('returns unified admin operational fields on payout getOne', async () => {
    const tx = await createTransactionWithEscrow(1000);

    const payout = await prisma.payout.create({
      data: {
        transactionId: tx.id,
        provider: 'MANUAL',
        status: 'REQUESTED',
        amount: 1000,
        currency: 'XAF',
        idempotencyKey: `payout:${tx.id}`,
      },
    });

    await prisma.refund.create({
      data: {
        transactionId: tx.id,
        provider: RefundProvider.MANUAL,
        status: RefundStatus.REQUESTED,
        amount: 400,
        currency: 'XAF',
        idempotencyKey: `refund:${tx.id}`,
      },
    });

    await prisma.dispute.create({
      data: {
        transactionId: tx.id,
        openedById: sender.id,
        reason: 'Damaged package',
        reasonCode: DisputeReasonCode.DAMAGED,
        openingSource: DisputeOpeningSource.MANUAL,
        initiatedBySide: 'SENDER',
        triggeredByRole: 'USER',
        status: DisputeStatus.OPEN,
      },
    });

    const res = await request(app.getHttpServer())
      .get(`/payouts/${payout.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(res.body.transactionSnapshot).toEqual({
      id: tx.id,
      status: 'DISPUTED',
      paymentStatus: 'SUCCESS',
      escrowAmount: 1000,
      senderId: sender.id,
      travelerId: traveler.id,
      currency: 'XAF',
    });

    expect(res.body.adminOperationalSnapshot).toEqual({
      hasOpenDispute: true,
      hasRequestedPayout: true,
      hasRequestedRefund: true,
      requiresAdminAttention: true,
    });
  });

  it('returns unified admin operational fields on refund getOne', async () => {
    const tx = await createTransactionWithEscrow(1000);

    await prisma.payout.create({
      data: {
        transactionId: tx.id,
        provider: 'MANUAL',
        status: 'PROCESSING',
        amount: 600,
        currency: 'XAF',
        idempotencyKey: `payout:${tx.id}`,
      },
    });

    const refund = await prisma.refund.create({
      data: {
        transactionId: tx.id,
        provider: RefundProvider.MANUAL,
        status: RefundStatus.REQUESTED,
        amount: 400,
        currency: 'XAF',
        idempotencyKey: `refund:${tx.id}`,
      },
    });

    await prisma.dispute.create({
      data: {
        transactionId: tx.id,
        openedById: sender.id,
        reason: 'Wrong item',
        reasonCode: DisputeReasonCode.WRONG_ITEM,
        openingSource: DisputeOpeningSource.MANUAL,
        initiatedBySide: 'SENDER',
        triggeredByRole: 'USER',
        status: DisputeStatus.OPEN,
      },
    });

    const res = await request(app.getHttpServer())
      .get(`/refunds/${refund.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(res.body.transactionSnapshot).toEqual({
      id: tx.id,
      status: 'DISPUTED',
      paymentStatus: 'SUCCESS',
      escrowAmount: 1000,
      senderId: sender.id,
      travelerId: traveler.id,
      currency: 'XAF',
    });

    expect(res.body.adminOperationalSnapshot).toEqual({
      hasOpenDispute: true,
      hasRequestedPayout: true,
      hasRequestedRefund: true,
      requiresAdminAttention: true,
    });
  });

  it('returns unified admin operational fields on dispute getOne', async () => {
    const tx = await createTransactionWithEscrow(1000);

    const payout = await prisma.payout.create({
      data: {
        transactionId: tx.id,
        provider: 'MANUAL',
        status: 'REQUESTED',
        amount: 600,
        currency: 'XAF',
        idempotencyKey: `payout:${tx.id}`,
      },
    });

    const refund = await prisma.refund.create({
      data: {
        transactionId: tx.id,
        provider: RefundProvider.MANUAL,
        status: RefundStatus.PROCESSING,
        amount: 400,
        currency: 'XAF',
        idempotencyKey: `refund:${tx.id}`,
      },
    });

    const dispute = await prisma.dispute.create({
      data: {
        transactionId: tx.id,
        openedById: sender.id,
        reason: 'Not delivered',
        reasonCode: DisputeReasonCode.NOT_DELIVERED,
        openingSource: DisputeOpeningSource.MANUAL,
        initiatedBySide: 'SENDER',
        triggeredByRole: 'USER',
        status: DisputeStatus.OPEN,
      },
    });

    const res = await request(app.getHttpServer())
      .get(`/disputes/${dispute.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(res.body.transactionSnapshot).toEqual({
      id: tx.id,
      status: 'DISPUTED',
      paymentStatus: 'SUCCESS',
      escrowAmount: 1000,
      senderId: sender.id,
      travelerId: traveler.id,
      currency: 'XAF',
    });

    expect(res.body.moneyFlowSnapshot).toEqual({
      payoutId: payout.id,
      payoutStatus: 'REQUESTED',
      payoutAmount: 600,
      refundId: refund.id,
      refundStatus: 'PROCESSING',
      refundAmount: 400,
    });

    expect(res.body.adminOperationalSnapshot).toEqual({
      hasOpenDispute: true,
      hasRequestedPayout: true,
      hasRequestedRefund: true,
      requiresAdminAttention: true,
    });
  });
});