import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import {
  DisputeReasonCode,
  PaymentStatus,
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

describe('Money / Dispute flows (e2e)', () => {
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

    admin = await createUserWithToken('admin@valises.test', Role.ADMIN);
    sender = await createUserWithToken('sender@valises.test', Role.USER);
    traveler = await createUserWithToken('traveler@valises.test', Role.USER);
  });

  async function cleanDatabase() {
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

  async function createTransactionWithEscrow(amount = 1000) {
    return prisma.transaction.create({
      data: {
        senderId: sender.id,
        travelerId: traveler.id,
        amount,
        commission: 0,
        escrowAmount: amount,
        status: TransactionStatus.DELIVERED,
        paymentStatus: PaymentStatus.SUCCESS,
      },
    });
  }

  async function seedEscrowCredit(transactionId: string, amount = 1000) {
    await prisma.ledgerEntry.create({
      data: {
        transactionId,
        type: 'ESCROW_CREDIT',
        amount,
        currency: 'XAF',
        note: 'Seed escrow credit for e2e',
        idempotencyKey: `seed_escrow_credit:${transactionId}`,
        source: 'PAYMENT',
        referenceType: 'PAYMENT',
        referenceId: `seed_payment:${transactionId}`,
        actorUserId: null,
      },
    });
  }

  it('payout admin flow: request payout -> mark paid -> ledger debited', async () => {
    const tx = await createTransactionWithEscrow(1000);
    await seedEscrowCredit(tx.id, 1000);

    const requestPayoutRes = await request(app.getHttpServer())
      .post(`/payouts/transactions/${tx.id}/request`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ provider: 'MANUAL' })
      .expect(201);

    expect(requestPayoutRes.body.transactionId).toBe(tx.id);
    expect(requestPayoutRes.body.status).toBe('REQUESTED');

    const payoutId = requestPayoutRes.body.id;

    const markPaidRes = await request(app.getHttpServer())
      .post(`/payouts/${payoutId}/mark-paid`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        externalReference: 'manual-paid-e2e',
        note: 'Paid in e2e',
      })
      .expect(201);

    expect(markPaidRes.body.status).toBe('PAID');

    const getPayoutRes = await request(app.getHttpServer())
      .get(`/payouts/transactions/${tx.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(getPayoutRes.body.status).toBe('PAID');

    const ledgerRes = await request(app.getHttpServer())
      .get(`/transactions/${tx.id}/ledger`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(ledgerRes.body.entries.map((e: any) => e.type)).toEqual([
      'ESCROW_CREDIT',
      'ESCROW_DEBIT_RELEASE',
    ]);

    const updatedTx = await prisma.transaction.findUniqueOrThrow({
      where: { id: tx.id },
    });

    expect(updatedTx.escrowAmount).toBe(0);
  });

  it('refund admin flow: mark refunded -> ledger debited -> partial escrow remains', async () => {
    const tx = await createTransactionWithEscrow(1000);
    await seedEscrowCredit(tx.id, 1000);

    const refund = await prisma.refund.create({
      data: {
        transactionId: tx.id,
        provider: 'MANUAL',
        status: 'READY',
        amount: 400,
        currency: 'XAF',
        idempotencyKey: `refund_request:${tx.id}`,
      },
    });

    const markRefundedRes = await request(app.getHttpServer())
      .post(`/refunds/${refund.id}/mark-refunded`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        externalReference: 'manual-refund-e2e',
        note: 'Refunded in e2e',
      })
      .expect(201);

    expect(markRefundedRes.body.status).toBe('REFUNDED');

    const getRefundRes = await request(app.getHttpServer())
      .get(`/refunds/transactions/${tx.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(getRefundRes.body.status).toBe('REFUNDED');

    const ledgerRes = await request(app.getHttpServer())
      .get(`/transactions/${tx.id}/ledger`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(ledgerRes.body.entries.map((e: any) => e.type)).toEqual([
      'ESCROW_CREDIT',
      'ESCROW_DEBIT_REFUND',
    ]);

    const updatedTx = await prisma.transaction.findUniqueOrThrow({
      where: { id: tx.id },
    });

    expect(updatedTx.escrowAmount).toBe(600);
    expect(updatedTx.paymentStatus).toBe('SUCCESS');
  });

  it('dispute resolve -> refund orchestration: refund created, ledger not yet debited', async () => {
    const tx = await createTransactionWithEscrow(1000);
    await seedEscrowCredit(tx.id, 1000);

    const createDisputeRes = await request(app.getHttpServer())
      .post('/disputes')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        transactionId: tx.id,
        reason: 'Package damaged',
        reasonCode: DisputeReasonCode.DAMAGED,
      })
      .expect(201);

    expect(createDisputeRes.body.status).toBe('OPEN');
    expect(createDisputeRes.body.openedById).toBe(sender.id);

    const disputeId = createDisputeRes.body.id;

    const resolveRes = await request(app.getHttpServer())
      .patch(`/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        decidedById: admin.id,
        outcome: 'REFUND_SENDER',
        evidenceLevel: 'STRONG',
      })
      .expect(200);

    expect(resolveRes.body.resolution.outcome).toBe('REFUND_SENDER');
    expect(resolveRes.body.refund).not.toBeNull();
    expect(resolveRes.body.refund.status).toBe('REQUESTED');
    expect(resolveRes.body.payout).toBeNull();

    const getRefundRes = await request(app.getHttpServer())
      .get(`/refunds/transactions/${tx.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(getRefundRes.body.status).toBe('REQUESTED');

    const ledgerRes = await request(app.getHttpServer())
      .get(`/transactions/${tx.id}/ledger`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(ledgerRes.body.entries.map((e: any) => e.type)).toEqual([
      'ESCROW_CREDIT',
    ]);
  });

  it('dispute resolve -> payout orchestration: payout created, ledger not yet debited', async () => {
    const tx = await createTransactionWithEscrow(1000);
    await seedEscrowCredit(tx.id, 1000);

    const createDisputeRes = await request(app.getHttpServer())
      .post('/disputes')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        transactionId: tx.id,
        reason: 'Sender no-show',
        reasonCode: DisputeReasonCode.NO_SHOW_SENDER,
      })
      .expect(201);

    expect(createDisputeRes.body.status).toBe('OPEN');
    expect(createDisputeRes.body.openedById).toBe(sender.id);

    const disputeId = createDisputeRes.body.id;

    const resolveRes = await request(app.getHttpServer())
      .patch(`/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        decidedById: admin.id,
        outcome: 'RELEASE_TO_TRAVELER',
        evidenceLevel: 'STRONG',
      })
      .expect(200);

    expect(resolveRes.body.resolution.outcome).toBe('RELEASE_TO_TRAVELER');
    expect(resolveRes.body.payout).not.toBeNull();
    expect(resolveRes.body.payout.status).toBe('REQUESTED');
    expect(resolveRes.body.refund).toBeNull();

    const getPayoutRes = await request(app.getHttpServer())
      .get(`/payouts/transactions/${tx.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(getPayoutRes.body.status).toBe('REQUESTED');

    const ledgerRes = await request(app.getHttpServer())
      .get(`/transactions/${tx.id}/ledger`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(ledgerRes.body.entries.map((e: any) => e.type)).toEqual([
      'ESCROW_CREDIT',
    ]);
  });
});