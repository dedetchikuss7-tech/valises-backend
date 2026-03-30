import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import {
  AbandonmentKind,
  CorridorPricingStatus,
  CurrencyCode,
  PackageStatus,
  PaymentMethodType,
  PaymentRailProvider,
  PaymentStatus,
  PricingConfidenceLevel,
  PricingSourceType,
  PayoutMethodType,
  Role,
  TransactionStatus,
  TripStatus,
} from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type SeedUser = {
  id: string;
  email: string;
  role: Role;
  token: string;
};

describe('Transaction pricing flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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

    sender = await createUserWithToken(
      `sender-${Date.now()}@valises.test`,
      Role.USER,
    );
    traveler = await createUserWithToken(
      `traveler-${Date.now()}@valises.test`,
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

  async function createPricingConfig(params: {
    corridorCode: string;
    originCountryCode: string;
    destinationCountryCode: string;
    settlementCurrency?: CurrencyCode;
    senderPricePerKg?: number | null;
    senderPriceBundle23kg?: number | null;
    senderPriceBundle32kg?: number | null;
    isEstimated?: boolean;
    pricingSourceType?: PricingSourceType;
    pricingCalibrationBasis?: string | null;
    pricingReferenceCorridorCode?: string | null;
    confidenceLevel?: PricingConfidenceLevel;
    isActive?: boolean;
    isVisible?: boolean;
    isBookable?: boolean;
    requiresManualReview?: boolean;
    status?: CorridorPricingStatus;
  }) {
    return prisma.corridorPricingPaymentConfig.create({
      data: {
        corridorCode: params.corridorCode,
        originCountryCode: params.originCountryCode,
        destinationCountryCode: params.destinationCountryCode,
        status: params.status ?? CorridorPricingStatus.SOCLE,
        pricingSourceType:
          params.pricingSourceType ?? PricingSourceType.OBSERVED,
        pricingCalibrationBasis:
          params.pricingCalibrationBasis ?? 'TERRAIN_DATA',
        pricingReferenceCorridorCode:
          params.pricingReferenceCorridorCode ?? null,
        confidenceLevel:
          params.confidenceLevel ?? PricingConfidenceLevel.HIGH,

        isEstimated: params.isEstimated ?? false,
        requiresManualReview: params.requiresManualReview ?? false,
        isVisible: params.isVisible ?? true,
        isBookable: params.isBookable ?? true,

        settlementCurrency: params.settlementCurrency ?? CurrencyCode.EUR,

        terrainPricePerKg: 10,
        terrainBundle23kg: 160,
        terrainBundle32kg: 210,

        travelerGainPerKg: 9,
        senderPricePerKg: params.senderPricePerKg ?? 11.5,
        spreadPerKg: 2.5,

        travelerGainBundle23kg: 145,
        senderPriceBundle23kg: params.senderPriceBundle23kg ?? 185,
        spreadBundle23kg: 40,

        travelerGainBundle32kg: 170,
        senderPriceBundle32kg: params.senderPriceBundle32kg ?? 210,
        spreadBundle32kg: 40,

        payinMethodsAllowed: [PaymentMethodType.CARD],
        payoutMethodsAllowed: [PayoutMethodType.MOBILE_MONEY],

        payinPrimaryRail: PaymentRailProvider.STRIPE,
        payinBackupRail: PaymentRailProvider.BANK,
        payoutPrimaryRail: PaymentRailProvider.CINETPAY,
        payoutBackupRail: PaymentRailProvider.MANUAL,
        fallbackRail: PaymentRailProvider.MANUAL,

        isActive: params.isActive ?? true,
        notes: 'Seeded in transaction pricing e2e',
      },
    });
  }

  it('lists pricing corridors with frontend-friendly summary signals, response metadata, total, and default sorting', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      settlementCurrency: CurrencyCode.EUR,
      pricingSourceType: PricingSourceType.OBSERVED,
      confidenceLevel: PricingConfidenceLevel.HIGH,
      isEstimated: false,
      isActive: true,
      isVisible: true,
      isBookable: true,
      status: CorridorPricingStatus.SOCLE,
    });

    await createPricingConfig({
      corridorCode: 'FR_CI',
      originCountryCode: 'FR',
      destinationCountryCode: 'CI',
      settlementCurrency: CurrencyCode.EUR,
      pricingSourceType: PricingSourceType.SIMILAR_INHERITED,
      pricingCalibrationBasis: 'SIMILAR_CORRIDOR_V1',
      pricingReferenceCorridorCode: 'FR_SN',
      confidenceLevel: PricingConfidenceLevel.MEDIUM,
      isEstimated: true,
      requiresManualReview: true,
      isActive: true,
      isVisible: true,
      isBookable: true,
      status: CorridorPricingStatus.SECONDARY,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .expect(200);

    expect(res.body).toEqual({
      items: [
        {
          corridorCode: 'FR_CI',
          originCountryCode: 'FR',
          destinationCountryCode: 'CI',
          status: 'SECONDARY',
          pricingSourceType: 'SIMILAR_INHERITED',
          pricingCalibrationBasis: 'SIMILAR_CORRIDOR_V1',
          pricingReferenceCorridorCode: 'FR_SN',
          confidenceLevel: 'MEDIUM',
          isEstimated: true,
          requiresManualReview: true,
          isVisible: true,
          isBookable: true,
          isActive: true,
          pricingBadge: 'ESTIMATED_MEDIUM_CONFIDENCE',
          pricingUiStatus: 'ESTIMATED',
          pricingUiTitle: 'Estimated pricing',
          pricingUiMessage:
            'This corridor uses estimated pricing and should be reviewed with caution.',
          settlementCurrency: 'EUR',
        },
        {
          corridorCode: 'FR_CM',
          originCountryCode: 'FR',
          destinationCountryCode: 'CM',
          status: 'SOCLE',
          pricingSourceType: 'OBSERVED',
          pricingCalibrationBasis: 'TERRAIN_DATA',
          pricingReferenceCorridorCode: null,
          confidenceLevel: 'HIGH',
          isEstimated: false,
          requiresManualReview: false,
          isVisible: true,
          isBookable: true,
          isActive: true,
          pricingBadge: 'OBSERVED_HIGH_CONFIDENCE',
          pricingUiStatus: 'READY',
          pricingUiTitle: 'Observed pricing',
          pricingUiMessage:
            'This corridor uses observed pricing with high confidence.',
          settlementCurrency: 'EUR',
        },
      ],
      count: 2,
      limit: 100,
      total: 2,
    });
  });

  it('lists pricing corridors filtered by corridorCode', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'BE_CM',
      originCountryCode: 'BE',
      destinationCountryCode: 'CM',
      settlementCurrency: CurrencyCode.EUR,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        corridorCode: 'fr_cm',
      })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].corridorCode).toBe('FR_CM');
  });

  it('lists pricing corridors with combined corridorCode and requiresManualReview filters', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      requiresManualReview: true,
      settlementCurrency: CurrencyCode.EUR,
      isEstimated: true,
      pricingSourceType: PricingSourceType.SIMILAR_INHERITED,
    });

    await createPricingConfig({
      corridorCode: 'BE_CM',
      originCountryCode: 'BE',
      destinationCountryCode: 'CM',
      requiresManualReview: false,
      settlementCurrency: CurrencyCode.EUR,
      pricingSourceType: PricingSourceType.OBSERVED,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        corridorCode: 'fr_cm',
        requiresManualReview: true,
      })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].corridorCode).toBe('FR_CM');
    expect(res.body.items[0].requiresManualReview).toBe(true);
  });

  it('lists pricing corridors with filters', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      settlementCurrency: CurrencyCode.EUR,
      status: CorridorPricingStatus.SOCLE,
      isVisible: true,
      isBookable: true,
      isActive: true,
    });

    await createPricingConfig({
      corridorCode: 'BE_CM',
      originCountryCode: 'BE',
      destinationCountryCode: 'CM',
      settlementCurrency: CurrencyCode.EUR,
      status: CorridorPricingStatus.SECONDARY,
      isVisible: false,
      isBookable: true,
      isActive: true,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        originCountryCode: 'fr',
        destinationCountryCode: 'cm',
        status: 'SOCLE',
        isVisible: true,
        isBookable: true,
        isActive: true,
        limit: 50,
      })
      .expect(200);

    expect(res.body).toEqual({
      items: [
        {
          corridorCode: 'FR_CM',
          originCountryCode: 'FR',
          destinationCountryCode: 'CM',
          status: 'SOCLE',
          pricingSourceType: 'OBSERVED',
          pricingCalibrationBasis: 'TERRAIN_DATA',
          pricingReferenceCorridorCode: null,
          confidenceLevel: 'HIGH',
          isEstimated: false,
          requiresManualReview: false,
          isVisible: true,
          isBookable: true,
          isActive: true,
          pricingBadge: 'OBSERVED_HIGH_CONFIDENCE',
          pricingUiStatus: 'READY',
          pricingUiTitle: 'Observed pricing',
          pricingUiMessage:
            'This corridor uses observed pricing with high confidence.',
          settlementCurrency: 'EUR',
        },
      ],
      count: 1,
      limit: 50,
      total: 1,
    });
  });

  it('lists pricing corridors filtered by pricingSourceType', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      pricingSourceType: PricingSourceType.OBSERVED,
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'FR_CI',
      originCountryCode: 'FR',
      destinationCountryCode: 'CI',
      pricingSourceType: PricingSourceType.SIMILAR_INHERITED,
      settlementCurrency: CurrencyCode.EUR,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        pricingSourceType: 'SIMILAR_INHERITED',
      })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].corridorCode).toBe('FR_CI');
    expect(res.body.items[0].pricingSourceType).toBe('SIMILAR_INHERITED');
  });

  it('lists pricing corridors filtered by pricingCalibrationBasis', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      pricingCalibrationBasis: 'TERRAIN_DATA',
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'FR_CI',
      originCountryCode: 'FR',
      destinationCountryCode: 'CI',
      pricingCalibrationBasis: 'SIMILAR_CORRIDOR_V1',
      settlementCurrency: CurrencyCode.EUR,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        pricingCalibrationBasis: 'SIMILAR_CORRIDOR_V1',
      })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].corridorCode).toBe('FR_CI');
  });

  it('lists pricing corridors filtered by pricingReferenceCorridorCode', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      pricingReferenceCorridorCode: 'FR_SN',
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'FR_CI',
      originCountryCode: 'FR',
      destinationCountryCode: 'CI',
      pricingReferenceCorridorCode: 'FR_CI',
      settlementCurrency: CurrencyCode.EUR,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        pricingReferenceCorridorCode: 'fr_sn',
      })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].corridorCode).toBe('FR_CM');
  });

  it('lists pricing corridors filtered by settlementCurrency', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'SN_FR',
      originCountryCode: 'SN',
      destinationCountryCode: 'FR',
      settlementCurrency: CurrencyCode.XOF,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        settlementCurrency: 'XOF',
      })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].corridorCode).toBe('SN_FR');
    expect(res.body.items[0].settlementCurrency).toBe('XOF');
  });

  it('lists pricing corridors with combined settlementCurrency and requiresManualReview filters', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      settlementCurrency: CurrencyCode.XOF,
      requiresManualReview: false,
    });

    await createPricingConfig({
      corridorCode: 'SN_FR',
      originCountryCode: 'SN',
      destinationCountryCode: 'FR',
      settlementCurrency: CurrencyCode.XOF,
      requiresManualReview: true,
    });

    await createPricingConfig({
      corridorCode: 'BE_CM',
      originCountryCode: 'BE',
      destinationCountryCode: 'CM',
      settlementCurrency: CurrencyCode.EUR,
      requiresManualReview: true,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        settlementCurrency: 'XOF',
        requiresManualReview: true,
      })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].corridorCode).toBe('SN_FR');
    expect(res.body.items[0].settlementCurrency).toBe('XOF');
    expect(res.body.items[0].requiresManualReview).toBe(true);
  });

  it('lists pricing corridors with combined pricingReferenceCorridorCode and requiresManualReview filters', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      pricingReferenceCorridorCode: 'FR_SN',
      requiresManualReview: false,
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'FR_CI',
      originCountryCode: 'FR',
      destinationCountryCode: 'CI',
      pricingReferenceCorridorCode: 'FR_SN',
      requiresManualReview: true,
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'BE_CM',
      originCountryCode: 'BE',
      destinationCountryCode: 'CM',
      pricingReferenceCorridorCode: 'BE_SN',
      requiresManualReview: true,
      settlementCurrency: CurrencyCode.EUR,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        pricingReferenceCorridorCode: 'fr_sn',
        requiresManualReview: true,
      })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].corridorCode).toBe('FR_CI');
    expect(res.body.items[0].requiresManualReview).toBe(true);
  });

  it('lists pricing corridors with combined pricingCalibrationBasis and requiresManualReview filters', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      pricingCalibrationBasis: 'SIMILAR_CORRIDOR_V1',
      requiresManualReview: false,
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'FR_CI',
      originCountryCode: 'FR',
      destinationCountryCode: 'CI',
      pricingCalibrationBasis: 'SIMILAR_CORRIDOR_V1',
      requiresManualReview: true,
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'BE_CM',
      originCountryCode: 'BE',
      destinationCountryCode: 'CM',
      pricingCalibrationBasis: 'TERRAIN_DATA',
      requiresManualReview: true,
      settlementCurrency: CurrencyCode.EUR,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        pricingCalibrationBasis: 'SIMILAR_CORRIDOR_V1',
        requiresManualReview: true,
      })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].corridorCode).toBe('FR_CI');
    expect(res.body.items[0].requiresManualReview).toBe(true);
  });

  it('lists pricing corridors with combined pricingSourceType and requiresManualReview filters', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      pricingSourceType: PricingSourceType.SIMILAR_INHERITED,
      requiresManualReview: false,
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'FR_CI',
      originCountryCode: 'FR',
      destinationCountryCode: 'CI',
      pricingSourceType: PricingSourceType.SIMILAR_INHERITED,
      requiresManualReview: true,
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'BE_CM',
      originCountryCode: 'BE',
      destinationCountryCode: 'CM',
      pricingSourceType: PricingSourceType.OBSERVED,
      requiresManualReview: true,
      settlementCurrency: CurrencyCode.EUR,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        pricingSourceType: 'SIMILAR_INHERITED',
        requiresManualReview: true,
      })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].corridorCode).toBe('FR_CI');
    expect(res.body.items[0].pricingSourceType).toBe('SIMILAR_INHERITED');
    expect(res.body.items[0].requiresManualReview).toBe(true);
  });

  it('lists pricing corridors filtered by estimated pricing', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      isEstimated: false,
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'FR_CI',
      originCountryCode: 'FR',
      destinationCountryCode: 'CI',
      isEstimated: true,
      settlementCurrency: CurrencyCode.EUR,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        isEstimated: true,
      })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].corridorCode).toBe('FR_CI');
    expect(res.body.items[0].isEstimated).toBe(true);
  });

  it('lists pricing corridors filtered by requiresManualReview=true', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      requiresManualReview: false,
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'FR_CI',
      originCountryCode: 'FR',
      destinationCountryCode: 'CI',
      requiresManualReview: true,
      settlementCurrency: CurrencyCode.EUR,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        requiresManualReview: true,
      })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].corridorCode).toBe('FR_CI');
    expect(res.body.items[0].requiresManualReview).toBe(true);
  });

  it('lists pricing corridors filtered by requiresManualReview=false', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      requiresManualReview: false,
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'FR_CI',
      originCountryCode: 'FR',
      destinationCountryCode: 'CI',
      requiresManualReview: true,
      settlementCurrency: CurrencyCode.EUR,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        requiresManualReview: false,
      })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].corridorCode).toBe('FR_CM');
    expect(res.body.items[0].requiresManualReview).toBe(false);
  });

  it('lists pricing corridors with combined requiresManualReview and isEstimated filters', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      isEstimated: true,
      requiresManualReview: false,
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'FR_CI',
      originCountryCode: 'FR',
      destinationCountryCode: 'CI',
      isEstimated: true,
      requiresManualReview: true,
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'BE_CM',
      originCountryCode: 'BE',
      destinationCountryCode: 'CM',
      isEstimated: false,
      requiresManualReview: true,
      settlementCurrency: CurrencyCode.EUR,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        isEstimated: true,
        requiresManualReview: true,
      })
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0].corridorCode).toBe('FR_CI');
    expect(res.body.items[0].isEstimated).toBe(true);
    expect(res.body.items[0].requiresManualReview).toBe(true);
  });

  it('lists pricing corridors sorted by confidence level descending', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      confidenceLevel: PricingConfidenceLevel.HIGH,
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'FR_CI',
      originCountryCode: 'FR',
      destinationCountryCode: 'CI',
      confidenceLevel: PricingConfidenceLevel.LOW,
      settlementCurrency: CurrencyCode.EUR,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        sortBy: 'confidenceLevel',
        sortOrder: 'desc',
      })
      .expect(200);

    expect(res.body.total).toBe(2);
    expect(res.body.items[0].confidenceLevel).toBe('LOW');
    expect(res.body.items[1].confidenceLevel).toBe('HIGH');
  });

  it('lists pricing corridors sorted by settlementCurrency ascending', async () => {
    await createPricingConfig({
      corridorCode: 'SN_FR',
      originCountryCode: 'SN',
      destinationCountryCode: 'FR',
      settlementCurrency: CurrencyCode.XOF,
    });

    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'US_SN',
      originCountryCode: 'US',
      destinationCountryCode: 'SN',
      settlementCurrency: CurrencyCode.USD,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        sortBy: 'settlementCurrency',
        sortOrder: 'asc',
      })
      .expect(200);

    expect(res.body.total).toBe(3);
    expect(res.body.count).toBe(3);
    expect(res.body.items[0].settlementCurrency).toBe('EUR');
    expect(res.body.items[1].settlementCurrency).toBe('USD');
    expect(res.body.items[2].settlementCurrency).toBe('XOF');
    expect(res.body.items[0].corridorCode).toBe('FR_CM');
    expect(res.body.items[1].corridorCode).toBe('US_SN');
    expect(res.body.items[2].corridorCode).toBe('SN_FR');
  });

  it('lists pricing corridors sorted by pricingSourceType ascending', async () => {
    await createPricingConfig({
      corridorCode: 'FR_SN',
      originCountryCode: 'FR',
      destinationCountryCode: 'SN',
      pricingSourceType: PricingSourceType.SIMILAR_INHERITED,
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      pricingSourceType: PricingSourceType.OBSERVED,
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'FR_CI',
      originCountryCode: 'FR',
      destinationCountryCode: 'CI',
      pricingSourceType: PricingSourceType.REGIONAL_TEMPLATE,
      settlementCurrency: CurrencyCode.EUR,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        sortBy: 'pricingSourceType',
        sortOrder: 'asc',
      })
      .expect(200);

    expect(res.body.total).toBe(3);
    expect(res.body.count).toBe(3);
    expect(res.body.items[0].pricingSourceType).toBe('OBSERVED');
    expect(res.body.items[1].pricingSourceType).toBe('SIMILAR_INHERITED');
    expect(res.body.items[2].pricingSourceType).toBe('REGIONAL_TEMPLATE');
    expect(res.body.items[0].corridorCode).toBe('FR_CM');
    expect(res.body.items[1].corridorCode).toBe('FR_SN');
    expect(res.body.items[2].corridorCode).toBe('FR_CI');
  });

  it('lists pricing corridors sorted by pricingCalibrationBasis descending', async () => {
    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      pricingCalibrationBasis: 'A_BASIS',
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'FR_SN',
      originCountryCode: 'FR',
      destinationCountryCode: 'SN',
      pricingCalibrationBasis: 'Z_BASIS',
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'FR_CI',
      originCountryCode: 'FR',
      destinationCountryCode: 'CI',
      pricingCalibrationBasis: 'M_BASIS',
      settlementCurrency: CurrencyCode.EUR,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        sortBy: 'pricingCalibrationBasis',
        sortOrder: 'desc',
      })
      .expect(200);

    expect(res.body.total).toBe(3);
    expect(res.body.count).toBe(3);
    expect(res.body.items[0].pricingCalibrationBasis).toBe('Z_BASIS');
    expect(res.body.items[1].pricingCalibrationBasis).toBe('M_BASIS');
    expect(res.body.items[2].pricingCalibrationBasis).toBe('A_BASIS');
    expect(res.body.items[0].corridorCode).toBe('FR_SN');
    expect(res.body.items[1].corridorCode).toBe('FR_CI');
    expect(res.body.items[2].corridorCode).toBe('FR_CM');
  });

  it('lists pricing corridors sorted by pricingReferenceCorridorCode ascending', async () => {
    await createPricingConfig({
      corridorCode: 'BE_CM',
      originCountryCode: 'BE',
      destinationCountryCode: 'CM',
      pricingReferenceCorridorCode: 'FR_SN',
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'FR_CI',
      originCountryCode: 'FR',
      destinationCountryCode: 'CI',
      pricingReferenceCorridorCode: 'FR_CI',
      settlementCurrency: CurrencyCode.EUR,
    });

    await createPricingConfig({
      corridorCode: 'LU_CM',
      originCountryCode: 'LU',
      destinationCountryCode: 'CM',
      pricingReferenceCorridorCode: 'FR_CM',
      settlementCurrency: CurrencyCode.EUR,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        sortBy: 'pricingReferenceCorridorCode',
        sortOrder: 'asc',
      })
      .expect(200);

    expect(res.body.total).toBe(3);
    expect(res.body.count).toBe(3);
    expect(res.body.items[0].pricingReferenceCorridorCode).toBe('FR_CI');
    expect(res.body.items[1].pricingReferenceCorridorCode).toBe('FR_CM');
    expect(res.body.items[2].pricingReferenceCorridorCode).toBe('FR_SN');
    expect(res.body.items[0].corridorCode).toBe('FR_CI');
    expect(res.body.items[1].corridorCode).toBe('LU_CM');
    expect(res.body.items[2].corridorCode).toBe('BE_CM');
  });

  it('returns corridor pricing by code with prudent and UI-facing signals', async () => {
    await createCorridor('FR_CM');

    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      settlementCurrency: CurrencyCode.EUR,
      pricingSourceType: PricingSourceType.OBSERVED,
      confidenceLevel: PricingConfidenceLevel.HIGH,
      isEstimated: false,
      isActive: true,
      isVisible: true,
      isBookable: true,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors/FR_CM')
      .set('Authorization', `Bearer ${sender.token}`)
      .expect(200);

    expect(res.body.corridorCode).toBe('FR_CM');
    expect(res.body.pricingSourceType).toBe('OBSERVED');
    expect(res.body.confidenceLevel).toBe('HIGH');

    expect(res.body.isEstimated).toBe(false);
    expect(res.body.pricingWarningCode).toBeNull();
    expect(res.body.pricingWarningMessage).toBeNull();
    expect(res.body.pricingBadge).toBe('OBSERVED_HIGH_CONFIDENCE');

    expect(res.body.pricingUiStatus).toBe('READY');
    expect(res.body.pricingUiTitle).toBe('Observed pricing');
    expect(res.body.pricingUiMessage).toBe(
      'This corridor uses observed pricing with high confidence.',
    );

    expect(res.body.settlementCurrency).toBe('EUR');
    expect(res.body.senderPricePerKg).toBe('11.5');
    expect(res.body.senderPriceBundle23kg).toBe('185');
    expect(res.body.senderPriceBundle32kg).toBe('210');
  });

  it('calculates pricing by corridor with prudent and UI-facing signals', async () => {
    await createCorridor('FR_CI');

    await createPricingConfig({
      corridorCode: 'FR_CI',
      originCountryCode: 'FR',
      destinationCountryCode: 'CI',
      settlementCurrency: CurrencyCode.EUR,
      pricingSourceType: PricingSourceType.SIMILAR_INHERITED,
      confidenceLevel: PricingConfidenceLevel.MEDIUM,
      isEstimated: true,
      isActive: true,
      isVisible: true,
      isBookable: true,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors/FR_CI/calculate')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        pricingModelType: 'PER_KG',
        weightKg: 10,
      })
      .expect(200);

    expect(res.body.corridorCode).toBe('FR_CI');
    expect(res.body.pricingModelType).toBe('PER_KG');
    expect(res.body.weightKg).toBe(10);

    expect(res.body.pricingSourceType).toBe('SIMILAR_INHERITED');
    expect(res.body.confidenceLevel).toBe('MEDIUM');
    expect(res.body.isEstimated).toBe(true);

    expect(res.body.pricingWarningCode).toBe('ESTIMATED_PRICING');
    expect(res.body.pricingWarningMessage).toBe(
      'This corridor uses estimated pricing.',
    );
    expect(res.body.pricingBadge).toBe('ESTIMATED_MEDIUM_CONFIDENCE');

    expect(res.body.pricingUiStatus).toBe('ESTIMATED');
    expect(res.body.pricingUiTitle).toBe('Estimated pricing');
    expect(res.body.pricingUiMessage).toBe(
      'This corridor uses estimated pricing and should be reviewed with caution.',
    );

    expect(res.body.senderPrice).toBe('115');
    expect(res.body.travelerGain).toBe('90');
    expect(res.body.spread).toBe('25');
  });

  it('returns 404 when corridor pricing is missing for get by code', async () => {
    const res = await request(app.getHttpServer())
      .get('/pricing/corridors/BE_CM')
      .set('Authorization', `Bearer ${sender.token}`)
      .expect(404);

    expect(res.body.message).toContain(
      'Pricing configuration not found for corridor BE_CM',
    );
  });

  it('returns 403 when corridor pricing is not bookable for calculate', async () => {
    await createCorridor('LU_CM');

    await createPricingConfig({
      corridorCode: 'LU_CM',
      originCountryCode: 'LU',
      destinationCountryCode: 'CM',
      settlementCurrency: CurrencyCode.EUR,
      isActive: true,
      isVisible: true,
      isBookable: false,
    });

    const res = await request(app.getHttpServer())
      .get('/pricing/corridors/LU_CM/calculate')
      .set('Authorization', `Bearer ${sender.token}`)
      .query({
        pricingModelType: 'BUNDLE_23KG',
      })
      .expect(403);

    expect(res.body.message).toContain(
      'Pricing configuration for corridor LU_CM is not bookable',
    );
  });

  it('creates a transaction with automatic 23kg bundle pricing and returns pricingDetails', async () => {
    const corridor = await createCorridor('FR_CM');
    const trip = await createTrip({
      carrierId: traveler.id,
      corridorId: corridor.id,
    });
    const pkg = await createPackage({
      senderId: sender.id,
      corridorId: corridor.id,
      weightKg: 23,
    });

    await createPricingConfig({
      corridorCode: 'FR_CM',
      originCountryCode: 'FR',
      destinationCountryCode: 'CM',
      settlementCurrency: CurrencyCode.EUR,
      senderPricePerKg: 11.5,
      senderPriceBundle23kg: 185,
      senderPriceBundle32kg: 210,
      isActive: true,
    });

    const res = await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        tripId: trip.id,
        packageId: pkg.id,
      })
      .expect(201);

    expect(res.body.transaction).toBeDefined();
    expect(res.body.pricingDetails).toBeDefined();

    expect(res.body.transaction.senderId).toBe(sender.id);
    expect(res.body.transaction.travelerId).toBe(traveler.id);
    expect(res.body.transaction.tripId).toBe(trip.id);
    expect(res.body.transaction.packageId).toBe(pkg.id);
    expect(res.body.transaction.corridorId).toBe(corridor.id);
    expect(res.body.transaction.amount).toBe(185);
    expect(res.body.transaction.currency).toBe('EUR');
    expect(res.body.transaction.status).toBe(TransactionStatus.CREATED);
    expect(res.body.transaction.paymentStatus).toBe(PaymentStatus.PENDING);

    expect(res.body.pricingDetails).toEqual({
      corridorCode: 'FR_CM',
      weightKg: 23,
      pricingModelApplied: 'BUNDLE_23KG',
      computedAmount: 185,
      settlementCurrency: 'EUR',
      senderPricePerKg: 11.5,
      senderPriceBundle23kg: 185,
      senderPriceBundle32kg: 210,
    });

    const updatedPackage = await prisma.package.findUniqueOrThrow({
      where: { id: pkg.id },
    });

    expect(updatedPackage.status).toBe(PackageStatus.RESERVED);

    const createdTransaction = await prisma.transaction.findFirstOrThrow({
      where: {
        packageId: pkg.id,
      },
    });

    expect(createdTransaction.amount).toBe(185);
    expect(createdTransaction.currency).toBe('EUR');
    expect(createdTransaction.status).toBe(TransactionStatus.CREATED);
    expect(createdTransaction.paymentStatus).toBe(PaymentStatus.PENDING);

    const abandonmentEvent = await prisma.abandonmentEvent.findFirst({
      where: {
        transactionId: createdTransaction.id,
        userId: sender.id,
        kind: AbandonmentKind.PAYMENT_PENDING,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    expect(abandonmentEvent).not.toBeNull();
  });

  it('creates a transaction with automatic per-kg pricing for standard weight', async () => {
    const corridor = await createCorridor('FR_CI');
    const trip = await createTrip({
      carrierId: traveler.id,
      corridorId: corridor.id,
    });
    const pkg = await createPackage({
      senderId: sender.id,
      corridorId: corridor.id,
      weightKg: 10,
    });

    await createPricingConfig({
      corridorCode: 'FR_CI',
      originCountryCode: 'FR',
      destinationCountryCode: 'CI',
      settlementCurrency: CurrencyCode.EUR,
      senderPricePerKg: 11.5,
      senderPriceBundle23kg: 160,
      senderPriceBundle32kg: 200,
      isActive: true,
    });

    const res = await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        tripId: trip.id,
        packageId: pkg.id,
      })
      .expect(201);

    expect(res.body.transaction.amount).toBe(115);
    expect(res.body.transaction.currency).toBe('EUR');

    expect(res.body.pricingDetails).toEqual({
      corridorCode: 'FR_CI',
      weightKg: 10,
      pricingModelApplied: 'PER_KG',
      computedAmount: 115,
      settlementCurrency: 'EUR',
      senderPricePerKg: 11.5,
      senderPriceBundle23kg: 160,
      senderPriceBundle32kg: 200,
    });
  });

  it('rejects transaction creation when pricing config is inactive', async () => {
    const corridor = await createCorridor('SN_FR');
    const trip = await createTrip({
      carrierId: traveler.id,
      corridorId: corridor.id,
    });
    const pkg = await createPackage({
      senderId: sender.id,
      corridorId: corridor.id,
      weightKg: 23,
    });

    await createPricingConfig({
      corridorCode: 'SN_FR',
      originCountryCode: 'SN',
      destinationCountryCode: 'FR',
      settlementCurrency: CurrencyCode.EUR,
      senderPricePerKg: 12.5,
      senderPriceBundle23kg: 170,
      senderPriceBundle32kg: 220,
      isActive: false,
    });

    const res = await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        tripId: trip.id,
        packageId: pkg.id,
      })
      .expect(400);

    expect(res.body.code).toBe('PRICING_CONFIG_INACTIVE');
    expect(res.body.corridorCode).toBe('SN_FR');

    const transactionCount = await prisma.transaction.count({
      where: {
        packageId: pkg.id,
      },
    });

    expect(transactionCount).toBe(0);

    const unchangedPackage = await prisma.package.findUniqueOrThrow({
      where: { id: pkg.id },
    });

    expect(unchangedPackage.status).toBe(PackageStatus.PUBLISHED);
  });

  it('rejects transaction creation when pricing config is missing', async () => {
    const corridor = await createCorridor('BE_CM');
    const trip = await createTrip({
      carrierId: traveler.id,
      corridorId: corridor.id,
    });
    const pkg = await createPackage({
      senderId: sender.id,
      corridorId: corridor.id,
      weightKg: 23,
    });

    const res = await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        tripId: trip.id,
        packageId: pkg.id,
      })
      .expect(400);

    expect(res.body.code).toBe('PRICING_CONFIG_NOT_FOUND');
    expect(res.body.corridorCode).toBe('BE_CM');

    const transactionCount = await prisma.transaction.count({
      where: {
        packageId: pkg.id,
      },
    });

    expect(transactionCount).toBe(0);

    const unchangedPackage = await prisma.package.findUniqueOrThrow({
      where: { id: pkg.id },
    });

    expect(unchangedPackage.status).toBe(PackageStatus.PUBLISHED);

    const abandonmentCount = await prisma.abandonmentEvent.count({
      where: {
        packageId: pkg.id,
      },
    });

    expect(abandonmentCount).toBe(0);
  });

  it('rejects transaction creation when pricing config is not bookable', async () => {
    const corridor = await createCorridor('LU_CM');
    const trip = await createTrip({
      carrierId: traveler.id,
      corridorId: corridor.id,
    });
    const pkg = await createPackage({
      senderId: sender.id,
      corridorId: corridor.id,
      weightKg: 23,
    });

    await createPricingConfig({
      corridorCode: 'LU_CM',
      originCountryCode: 'LU',
      destinationCountryCode: 'CM',
      settlementCurrency: CurrencyCode.EUR,
      senderPricePerKg: 10,
      senderPriceBundle23kg: 150,
      senderPriceBundle32kg: 205,
      isActive: true,
      isVisible: true,
      isBookable: false,
    });

    const res = await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        tripId: trip.id,
        packageId: pkg.id,
      })
      .expect(400);

    expect(res.body.code).toBe('PRICING_CONFIG_NOT_BOOKABLE');
    expect(res.body.corridorCode).toBe('LU_CM');

    const transactionCount = await prisma.transaction.count({
      where: {
        packageId: pkg.id,
      },
    });

    expect(transactionCount).toBe(0);

    const unchangedPackage = await prisma.package.findUniqueOrThrow({
      where: { id: pkg.id },
    });

    expect(unchangedPackage.status).toBe(PackageStatus.PUBLISHED);

    const abandonmentCount = await prisma.abandonmentEvent.count({
      where: {
        packageId: pkg.id,
      },
    });

    expect(abandonmentCount).toBe(0);
  });

  it('rejects transaction creation when pricing config is not visible', async () => {
    const corridor = await createCorridor('IT_CM');
    const trip = await createTrip({
      carrierId: traveler.id,
      corridorId: corridor.id,
    });
    const pkg = await createPackage({
      senderId: sender.id,
      corridorId: corridor.id,
      weightKg: 23,
    });

    await createPricingConfig({
      corridorCode: 'IT_CM',
      originCountryCode: 'IT',
      destinationCountryCode: 'CM',
      settlementCurrency: CurrencyCode.EUR,
      senderPricePerKg: 11,
      senderPriceBundle23kg: 180,
      senderPriceBundle32kg: 220,
      isActive: true,
      isVisible: false,
      isBookable: true,
    });

    const res = await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        tripId: trip.id,
        packageId: pkg.id,
      })
      .expect(400);

    expect(res.body.code).toBe('PRICING_CONFIG_NOT_VISIBLE');
    expect(res.body.corridorCode).toBe('IT_CM');

    const transactionCount = await prisma.transaction.count({
      where: {
        packageId: pkg.id,
      },
    });

    expect(transactionCount).toBe(0);

    const unchangedPackage = await prisma.package.findUniqueOrThrow({
      where: { id: pkg.id },
    });

    expect(unchangedPackage.status).toBe(PackageStatus.PUBLISHED);

    const abandonmentCount = await prisma.abandonmentEvent.count({
      where: {
        packageId: pkg.id,
      },
    });

    expect(abandonmentCount).toBe(0);
  });

  it('rejects transaction creation when pricing config requires manual review', async () => {
    const corridor = await createCorridor('DE_CM');
    const trip = await createTrip({
      carrierId: traveler.id,
      corridorId: corridor.id,
    });
    const pkg = await createPackage({
      senderId: sender.id,
      corridorId: corridor.id,
      weightKg: 23,
    });

    await createPricingConfig({
      corridorCode: 'DE_CM',
      originCountryCode: 'DE',
      destinationCountryCode: 'CM',
      settlementCurrency: CurrencyCode.EUR,
      senderPricePerKg: 11.5,
      senderPriceBundle23kg: 170,
      senderPriceBundle32kg: 205,
      isActive: true,
      isVisible: true,
      isBookable: true,
      requiresManualReview: true,
    });

    const res = await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        tripId: trip.id,
        packageId: pkg.id,
      })
      .expect(400);

    expect(res.body.code).toBe('PRICING_CONFIG_REQUIRES_MANUAL_REVIEW');
    expect(res.body.corridorCode).toBe('DE_CM');

    const transactionCount = await prisma.transaction.count({
      where: {
        packageId: pkg.id,
      },
    });

    expect(transactionCount).toBe(0);

    const unchangedPackage = await prisma.package.findUniqueOrThrow({
      where: { id: pkg.id },
    });

    expect(unchangedPackage.status).toBe(PackageStatus.PUBLISHED);

    const abandonmentCount = await prisma.abandonmentEvent.count({
      where: {
        packageId: pkg.id,
      },
    });

    expect(abandonmentCount).toBe(0);
  });
});