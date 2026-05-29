import { Test, TestingModule } from '@nestjs/testing';
import { ReadinessService } from './readiness.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  $queryRaw: jest.fn(),
  corridor: { count: jest.fn() },
  user: { count: jest.fn() },
  deviceToken: { count: jest.fn() },
  dataExportRequest: { count: jest.fn() },
};

describe('ReadinessService', () => {
  let service: ReadinessService;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgresql://test',
      JWT_SECRET: 'test-secret-long-enough',
      PAYMENT_PROVIDER: 'CINETPAY',
      STORAGE_PROVIDER: 'S3',
      CINETPAY_API_KEY: 'test-key',
      CINETPAY_SITE_ID: 'test-site',
      AWS_ACCESS_KEY_ID: 'test-key-id',
      AWS_SECRET_ACCESS_KEY: 'test-secret',
      AWS_S3_BUCKET: 'test-bucket',
      AWS_REGION: 'us-east-1',
      SENDGRID_API_KEY: 'SG.test',
      NOTIFICATIONS_ENABLED: 'false',
      // lots #300-#319
      EMAIL_PROVIDER: 'SENDGRID',
      PUSH_PROVIDER: 'FCM',
      RATE_LIMIT_TRANSACTIONS_PER_HOUR: '100',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadinessService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReadinessService>(ReadinessService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function setupHappyPath(corridorCount = 5, activeCorridors = 3, adminCount = 1) {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ 1: 1 }])
      .mockResolvedValueOnce([{ count: BigInt(0) }]);
    mockPrisma.corridor.count
      .mockResolvedValueOnce(corridorCount)
      .mockResolvedValueOnce(activeCorridors);
    mockPrisma.user.count.mockResolvedValue(adminCount);
    mockPrisma.deviceToken.count.mockResolvedValue(0);
    mockPrisma.dataExportRequest.count.mockResolvedValue(0);
  }

  it('returns READY when all checks pass', async () => {
    setupHappyPath();

    const report = await service.getReadinessReport();
    expect(report.overall).toBe('READY');
    expect(report.checks.every((c) => c.status !== 'FAIL')).toBe(true);
  });

  it('returns NOT_READY when database is unreachable', async () => {
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('Connection refused'));
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]);
    mockPrisma.corridor.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.deviceToken.count.mockResolvedValue(0);
    mockPrisma.dataExportRequest.count.mockResolvedValue(0);

    const report = await service.getReadinessReport();
    expect(report.overall).toBe('NOT_READY');
    const dbCheck = report.checks.find((c) => c.name === 'database_connectivity');
    expect(dbCheck?.status).toBe('FAIL');
  });

  it('returns NOT_READY when no corridors seeded', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ 1: 1 }])
      .mockResolvedValueOnce([{ count: BigInt(0) }]);
    mockPrisma.corridor.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.deviceToken.count.mockResolvedValue(0);
    mockPrisma.dataExportRequest.count.mockResolvedValue(0);

    const report = await service.getReadinessReport();
    expect(report.overall).toBe('NOT_READY');
    const check = report.checks.find((c) => c.name === 'corridor_seeds');
    expect(check?.status).toBe('FAIL');
  });

  it('returns NOT_READY when no admin user exists', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ 1: 1 }])
      .mockResolvedValueOnce([{ count: BigInt(0) }]);
    mockPrisma.corridor.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.deviceToken.count.mockResolvedValue(0);
    mockPrisma.dataExportRequest.count.mockResolvedValue(0);

    const report = await service.getReadinessReport();
    expect(report.overall).toBe('NOT_READY');
    const check = report.checks.find((c) => c.name === 'admin_user');
    expect(check?.status).toBe('FAIL');
  });

  it('WARN on MOCK payment provider does not fail overall', async () => {
    process.env.PAYMENT_PROVIDER = 'MOCK';
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ 1: 1 }])
      .mockResolvedValueOnce([{ count: BigInt(0) }]);
    mockPrisma.corridor.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.deviceToken.count.mockResolvedValue(0);
    mockPrisma.dataExportRequest.count.mockResolvedValue(0);

    const report = await service.getReadinessReport();
    expect(report.overall).toBe('READY_WITH_WARNINGS');
    const check = report.checks.find((c) => c.name === 'payment_provider');
    expect(check?.status).toBe('WARN');
  });

  it('WARN on MOCK_STORAGE does not fail overall', async () => {
    process.env.STORAGE_PROVIDER = 'MOCK_STORAGE';
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ 1: 1 }])
      .mockResolvedValueOnce([{ count: BigInt(0) }]);
    mockPrisma.corridor.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.deviceToken.count.mockResolvedValue(0);
    mockPrisma.dataExportRequest.count.mockResolvedValue(0);

    const report = await service.getReadinessReport();
    expect(report.overall).toBe('READY_WITH_WARNINGS');
    const check = report.checks.find((c) => c.name === 'storage_provider');
    expect(check?.status).toBe('WARN');
  });

  it('FAIL when PAYMENT_PROVIDER=CINETPAY but keys missing', async () => {
    delete process.env.CINETPAY_API_KEY;
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ 1: 1 }])
      .mockResolvedValueOnce([{ count: BigInt(0) }]);
    mockPrisma.corridor.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.deviceToken.count.mockResolvedValue(0);
    mockPrisma.dataExportRequest.count.mockResolvedValue(0);

    const report = await service.getReadinessReport();
    expect(report.overall).toBe('NOT_READY');
    const check = report.checks.find((c) => c.name === 'payment_provider');
    expect(check?.status).toBe('FAIL');
  });

  it('report always includes checkedAt timestamp', async () => {
    setupHappyPath();

    const report = await service.getReadinessReport();
    expect(report.checkedAt).toBeDefined();
    expect(new Date(report.checkedAt).getTime()).not.toBeNaN();
  });

  it('report includes failCount, warnCount, lotsCompleted', async () => {
    setupHappyPath();

    const report = await service.getReadinessReport();
    expect(report.failCount).toBe(0);
    expect(report.warnCount).toBe(0);
    expect(report.lotsCompleted).toBe('286-320');
  });

  it('WARN on missing EMAIL_PROVIDER does not fail overall', async () => {
    delete process.env.EMAIL_PROVIDER;
    setupHappyPath();

    const report = await service.getReadinessReport();
    expect(report.overall).toBe('READY_WITH_WARNINGS');
    const check = report.checks.find((c) => c.name === 'email_provider');
    expect(check?.status).toBe('WARN');
  });

  it('WARN on missing PUSH_PROVIDER does not fail overall', async () => {
    delete process.env.PUSH_PROVIDER;
    setupHappyPath();

    const report = await service.getReadinessReport();
    expect(report.overall).toBe('READY_WITH_WARNINGS');
    const check = report.checks.find((c) => c.name === 'push_provider');
    expect(check?.status).toBe('WARN');
  });

  it('FAIL when device_tokens table inaccessible', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ 1: 1 }])
      .mockResolvedValueOnce([{ count: BigInt(0) }]);
    mockPrisma.corridor.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.deviceToken.count.mockRejectedValue(new Error('table missing'));
    mockPrisma.dataExportRequest.count.mockResolvedValue(0);

    const report = await service.getReadinessReport();
    expect(report.overall).toBe('NOT_READY');
    const check = report.checks.find((c) => c.name === 'device_tokens');
    expect(check?.status).toBe('FAIL');
  });
});
