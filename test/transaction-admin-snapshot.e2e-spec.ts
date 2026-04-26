import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import {
  PackageStatus,
  PaymentStatus,
  RefundProvider,
  RefundStatus,
  Role,
  TransactionStatus,
  TripStatus,
  DisputeOpeningSource,
  DisputeReasonCode,
  DisputeStatus,
} from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type SeedUser = {
  id: string;
  email: string;
  role: Role;
  token: string;
};

describe('Transaction admin operational snapshot (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let sender: SeedUser;
  let traveler: SeedUser;
  let admin: SeedUser;

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

    sender = await createUserWithToken(
      `sender-${Date.now()}@valises.test`,
      Role.USER,
    );
    traveler = await createUserWithToken(
      `traveler-${Date.now()}@valises.test`,
      Role.USER,
    );
    admin = await createUserWithToken(
      `admin-${Date.now()}@valises.test`,
      Role.ADMIN,
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

  async function createCorridor(code: string) {
    return prisma.corridor.create({
      data: {
        code,
        name: code,
        status: 'ACTIVE',
      },
    });
  }

  async function createTrip(params: { carrierId: string; corridorId: string }) {
    return prisma.trip.create({
      data: {
        carrierId: params.carrierId,
        corridorId: params.corridorId,
        departAt: new Date('2026-04-10T10:00:00.000Z'),
        capacityKg: 32,
        status: TripStatus.ACTIVE,
        flightTicketStatus: 'VERIFIED',
      },
    });
  }

  async function createPackage(params: {
    senderId: string;
    corridorId: string;
    weightKg: number;
  }) {
    return prisma.package.create({
      data: {
        senderId: params.senderId,
        corridorId: params.corridorId,
        weightKg: params.weightKg,
        description: `Package ${params.weightKg}kg`,
        status: PackageStatus.PUBLISHED,
      },
    });
  }

  it('returns payout refund dispute and admin operational snapshot on GET /transactions/:id for admin', async () => {
    const corridor = await createCorridor('FR_CM');
    const trip = await createTrip({
      carrierId: traveler.id,
      corridorId: corridor.id,
    });
    const pkg = await createPackage({
      senderId: sender.id,
      corridorId: corridor.id,
      weightKg: 10,
    });

    const tx = await prisma.transaction.create({
      data: {
        senderId: sender.id,
        travelerId: traveler.id,
        tripId: trip.id,
        packageId: pkg.id,
        corridorId: corridor.id,
        amount: 1000,
        commission: 0,
        escrowAmount: 1000,
        currency: 'EUR',
        status: TransactionStatus.DISPUTED,
        paymentStatus: PaymentStatus.SUCCESS,
      },
    });

    const payout = await prisma.payout.create({
      data: {
        transactionId: tx.id,
        provider: 'MANUAL' as any,
        status: 'REQUESTED' as any,
        amount: 1000,
        currency: 'EUR',
        idempotencyKey: `payout:${tx.id}`,
      },
    });

    const refund = await prisma.refund.create({
      data: {
        transactionId: tx.id,
        provider: RefundProvider.MANUAL,
        status: RefundStatus.REQUESTED,
        amount: 1000,
        currency: 'EUR',
        idempotencyKey: `refund:${tx.id}`,
      },
    });

    const dispute = await prisma.dispute.create({
      data: {
        transactionId: tx.id,
        openedById: sender.id,
        reason: 'Operational dispute opened',
        reasonCode: DisputeReasonCode.DAMAGED,
        openingSource: DisputeOpeningSource.MANUAL,
        initiatedBySide: 'SENDER',
        triggeredByRole: 'USER',
        status: DisputeStatus.OPEN,
      },
    });

    const res = await request(app.getHttpServer())
      .get(`/transactions/${tx.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(res.body.id).toBe(tx.id);

    expect(res.body.payout).toEqual({
      id: payout.id,
      status: 'REQUESTED',
      provider: 'MANUAL',
      railProvider: null,
      payoutMethodType: null,
      externalReference: null,
      amount: 1000,
      currency: 'EUR',
    });

    expect(res.body.refund).toEqual({
      id: refund.id,
      status: 'REQUESTED',
      provider: 'MANUAL',
      amount: 1000,
      currency: 'EUR',
    });

    expect(res.body.dispute).toEqual({
      id: dispute.id,
      status: 'OPEN',
      reasonCode: 'DAMAGED',
      openingSource: 'MANUAL',
      openedById: sender.id,
      createdAt: dispute.createdAt.toISOString(),
      resolutionOutcome: null,
    });

    expect(res.body.adminOperationalSnapshot).toEqual({
      hasOpenDispute: true,
      hasRequestedPayout: true,
      hasRequestedRefund: true,
      requiresAdminAttention: true,
    });
  });

  it('returns admin operational snapshot in GET /transactions list', async () => {
    const corridor = await createCorridor('BE_CM');
    const trip = await createTrip({
      carrierId: traveler.id,
      corridorId: corridor.id,
    });
    const pkg = await createPackage({
      senderId: sender.id,
      corridorId: corridor.id,
      weightKg: 10,
    });

    const tx = await prisma.transaction.create({
      data: {
        senderId: sender.id,
        travelerId: traveler.id,
        tripId: trip.id,
        packageId: pkg.id,
        corridorId: corridor.id,
        amount: 700,
        commission: 0,
        escrowAmount: 700,
        currency: 'EUR',
        status: TransactionStatus.PAID,
        paymentStatus: PaymentStatus.SUCCESS,
      },
    });

    await prisma.refund.create({
      data: {
        transactionId: tx.id,
        provider: RefundProvider.MANUAL,
        status: RefundStatus.PROCESSING,
        amount: 700,
        currency: 'EUR',
        idempotencyKey: `refund:list:${tx.id}`,
      },
    });

    const res = await request(app.getHttpServer())
      .get('/transactions')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);

    expect(res.body[0].refund).toEqual({
      id: expect.any(String),
      status: 'PROCESSING',
      provider: 'MANUAL',
      amount: 700,
      currency: 'EUR',
    });

    expect(res.body[0].dispute).toBeNull();
    expect(res.body[0].payout).toBeNull();

    expect(res.body[0].adminOperationalSnapshot).toEqual({
      hasOpenDispute: false,
      hasRequestedPayout: false,
      hasRequestedRefund: true,
      requiresAdminAttention: true,
    });
  });
});