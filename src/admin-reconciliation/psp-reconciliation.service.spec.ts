import { NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PspReconciliationService } from './psp-reconciliation.service';

const makeRun = (overrides: any = {}) => ({
  id: 'run-1',
  initiatedById: 'admin-1',
  startedAt: new Date(),
  completedAt: null,
  dateFrom: new Date('2026-05-01'),
  dateTo: new Date('2026-05-24'),
  dryRun: false,
  totalChecked: 0,
  verified: 0,
  skipped: 0,
  discrepanciesFound: 0,
  provider: 'CINETPAY',
  status: 'RUNNING',
  errorMessage: null,
  metadata: null,
  createdAt: new Date(),
  ...overrides,
});

const makeTx = (overrides: any = {}) => ({
  id: 'tx-1',
  paymentStatus: PaymentStatus.SUCCESS,
  payinProviderReference: 'cp-ref-001',
  amount: 5000,
  currency: 'XAF',
  ...overrides,
});

describe('PspReconciliationService', () => {
  let service: PspReconciliationService;

  const prismaMock = {
    reconciliationRun: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    reconciliationCase: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
    },
  };

  const cinetPayMock = {
    verifyTransaction: jest.fn(),
  };

  const configMock = {
    get: jest.fn().mockReturnValue('CINETPAY'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    configMock.get.mockReturnValue('CINETPAY');
    service = new PspReconciliationService(
      prismaMock as any,
      cinetPayMock as any,
      configMock as any,
    );
  });

  describe('triggerRun', () => {
    it('creates COMPLETED run with zero discrepancies when PSP matches', async () => {
      const run = makeRun();
      prismaMock.reconciliationRun.create.mockResolvedValue(run);
      prismaMock.transaction.findMany.mockResolvedValue([makeTx()]);
      cinetPayMock.verifyTransaction.mockResolvedValue({
        found: true,
        pspStatus: 'ACCEPTED',
        pspAmount: 5000,
        currency: 'XAF',
        rawResponse: {},
      });
      prismaMock.reconciliationRun.update.mockResolvedValue({
        ...run,
        status: 'COMPLETED',
        completedAt: new Date(),
        totalChecked: 1,
        verified: 1,
        skipped: 0,
        discrepanciesFound: 0,
      });

      const result = await service.triggerRun(
        { dateFrom: new Date('2026-05-01'), dateTo: new Date('2026-05-24'), dryRun: false },
        'admin-1',
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.discrepanciesFound).toBe(0);
      expect(result.verified).toBe(1);
      expect(prismaMock.reconciliationCase.create).not.toHaveBeenCalled();
    });

    it('creates ReconciliationCase for PSP_STATUS_MISMATCH (local SUCCESS, PSP REFUSED)', async () => {
      const run = makeRun();
      prismaMock.reconciliationRun.create.mockResolvedValue(run);
      prismaMock.transaction.findMany.mockResolvedValue([makeTx()]);
      cinetPayMock.verifyTransaction.mockResolvedValue({
        found: true,
        pspStatus: 'REFUSED',
        pspAmount: 5000,
        currency: 'XAF',
        rawResponse: {},
      });
      prismaMock.reconciliationCase.create.mockResolvedValue({});
      prismaMock.reconciliationRun.update.mockResolvedValue({
        ...run,
        status: 'COMPLETED',
        totalChecked: 1,
        discrepanciesFound: 1,
      });

      const result = await service.triggerRun(
        { dateFrom: new Date('2026-05-01'), dateTo: new Date('2026-05-24'), dryRun: false },
        'admin-1',
      );

      expect(result.discrepanciesFound).toBe(1);
      expect(prismaMock.reconciliationCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ discrepancyType: 'PSP_STATUS_MISMATCH', severity: 'CRITICAL' }),
        }),
      );
    });

    it('creates CRITICAL case for PSP_NOT_FOUND when local status is SUCCESS', async () => {
      const run = makeRun();
      prismaMock.reconciliationRun.create.mockResolvedValue(run);
      prismaMock.transaction.findMany.mockResolvedValue([makeTx()]);
      cinetPayMock.verifyTransaction.mockResolvedValue({
        found: false,
        pspStatus: null,
        pspAmount: null,
        currency: null,
        rawResponse: {},
      });
      prismaMock.reconciliationCase.create.mockResolvedValue({});
      prismaMock.reconciliationRun.update.mockResolvedValue({
        ...run,
        status: 'COMPLETED',
        totalChecked: 1,
        discrepanciesFound: 1,
      });

      await service.triggerRun(
        { dateFrom: new Date('2026-05-01'), dateTo: new Date('2026-05-24'), dryRun: false },
        'admin-1',
      );

      expect(prismaMock.reconciliationCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ discrepancyType: 'PSP_NOT_FOUND', severity: 'CRITICAL' }),
        }),
      );
    });

    it('does not create case for PSP_NOT_FOUND when local status is PENDING', async () => {
      const run = makeRun();
      prismaMock.reconciliationRun.create.mockResolvedValue(run);
      prismaMock.transaction.findMany.mockResolvedValue([
        makeTx({ paymentStatus: PaymentStatus.PENDING }),
      ]);
      cinetPayMock.verifyTransaction.mockResolvedValue({
        found: false,
        pspStatus: null,
        pspAmount: null,
        currency: null,
        rawResponse: {},
      });
      prismaMock.reconciliationRun.update.mockResolvedValue({
        ...run,
        status: 'COMPLETED',
        totalChecked: 1,
        verified: 1,
        discrepanciesFound: 0,
      });

      const result = await service.triggerRun(
        { dateFrom: new Date('2026-05-01'), dateTo: new Date('2026-05-24'), dryRun: false },
        'admin-1',
      );

      expect(result.discrepanciesFound).toBe(0);
      expect(prismaMock.reconciliationCase.create).not.toHaveBeenCalled();
    });

    it('does NOT persist cases in dryRun mode', async () => {
      const run = makeRun({ dryRun: true });
      prismaMock.reconciliationRun.create.mockResolvedValue(run);
      prismaMock.transaction.findMany.mockResolvedValue([makeTx()]);
      cinetPayMock.verifyTransaction.mockResolvedValue({
        found: true,
        pspStatus: 'REFUSED',
        pspAmount: 5000,
        currency: 'XAF',
        rawResponse: {},
      });
      prismaMock.reconciliationRun.update.mockResolvedValue({
        ...run,
        status: 'COMPLETED',
        discrepanciesFound: 1,
      });

      await service.triggerRun(
        { dateFrom: new Date('2026-05-01'), dateTo: new Date('2026-05-24'), dryRun: true },
        'admin-1',
      );

      expect(prismaMock.reconciliationCase.create).not.toHaveBeenCalled();
    });

    it('skips all transactions when PAYMENT_PROVIDER is not CINETPAY', async () => {
      configMock.get.mockReturnValue('MOCK');
      const run = makeRun();
      prismaMock.reconciliationRun.create.mockResolvedValue(run);
      prismaMock.transaction.findMany.mockResolvedValue([makeTx(), makeTx({ id: 'tx-2' })]);
      prismaMock.reconciliationRun.update.mockResolvedValue({
        ...run,
        status: 'COMPLETED',
        totalChecked: 2,
        skipped: 2,
        discrepanciesFound: 0,
      });

      const result = await service.triggerRun(
        { dateFrom: new Date('2026-05-01'), dateTo: new Date('2026-05-24') },
        'admin-1',
      );

      expect(cinetPayMock.verifyTransaction).not.toHaveBeenCalled();
      expect(result.skipped).toBe(2);
    });

    it('skips transaction and continues when PSP verify throws', async () => {
      const run = makeRun();
      prismaMock.reconciliationRun.create.mockResolvedValue(run);
      prismaMock.transaction.findMany.mockResolvedValue([makeTx()]);
      cinetPayMock.verifyTransaction.mockRejectedValue(new Error('timeout'));
      prismaMock.reconciliationRun.update.mockResolvedValue({
        ...run,
        status: 'COMPLETED',
        totalChecked: 1,
        skipped: 1,
        discrepanciesFound: 0,
      });

      const result = await service.triggerRun(
        { dateFrom: new Date('2026-05-01'), dateTo: new Date('2026-05-24') },
        'admin-1',
      );

      expect(result.skipped).toBe(1);
      expect(result.discrepanciesFound).toBe(0);
    });

    it('creates AMOUNT_MISMATCH case when PSP amount differs from local', async () => {
      const run = makeRun();
      prismaMock.reconciliationRun.create.mockResolvedValue(run);
      prismaMock.transaction.findMany.mockResolvedValue([makeTx()]);
      cinetPayMock.verifyTransaction.mockResolvedValue({
        found: true,
        pspStatus: 'ACCEPTED',
        pspAmount: 4999,
        currency: 'XAF',
        rawResponse: {},
      });
      prismaMock.reconciliationCase.create.mockResolvedValue({});
      prismaMock.reconciliationRun.update.mockResolvedValue({
        ...run,
        status: 'COMPLETED',
        discrepanciesFound: 1,
      });

      await service.triggerRun(
        { dateFrom: new Date('2026-05-01'), dateTo: new Date('2026-05-24') },
        'admin-1',
      );

      expect(prismaMock.reconciliationCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ discrepancyType: 'AMOUNT_MISMATCH' }),
        }),
      );
    });

    it('marks run FAILED and rethrows when a fatal DB error occurs', async () => {
      const run = makeRun();
      prismaMock.reconciliationRun.create.mockResolvedValue(run);
      prismaMock.transaction.findMany.mockRejectedValue(new Error('DB down'));
      prismaMock.reconciliationRun.update.mockResolvedValue({ ...run, status: 'FAILED' });

      await expect(
        service.triggerRun(
          { dateFrom: new Date('2026-05-01'), dateTo: new Date('2026-05-24') },
          'admin-1',
        ),
      ).rejects.toThrow('DB down');

      expect(prismaMock.reconciliationRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });
  });

  describe('listRuns', () => {
    it('returns paginated list of runs', async () => {
      prismaMock.reconciliationRun.count.mockResolvedValue(2);
      prismaMock.reconciliationRun.findMany.mockResolvedValue([makeRun(), makeRun({ id: 'run-2' })]);

      const result = await service.listRuns({ limit: 20, offset: 0 });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
    });
  });

  describe('getRunById', () => {
    it('returns run with its cases', async () => {
      prismaMock.reconciliationRun.findUnique.mockResolvedValue(makeRun({ status: 'COMPLETED' }));
      prismaMock.reconciliationCase.findMany.mockResolvedValue([
        {
          id: 'case-1',
          reconciliationRunId: 'run-1',
          transactionId: 'tx-1',
          payinProviderRef: 'cp-ref',
          discrepancyType: 'PSP_STATUS_MISMATCH',
          severity: 'CRITICAL',
          localStatus: 'SUCCESS',
          pspStatus: 'REFUSED',
          localAmount: 5000,
          pspAmount: 5000,
          firstDetectedAt: new Date(),
          lastCheckedAt: new Date(),
          verificationAttempts: 1,
          resolvedAt: null,
          resolvedById: null,
          notes: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getRunById('run-1');

      expect(result.id).toBe('run-1');
      expect(result.cases).toHaveLength(1);
      expect(result.cases![0].discrepancyType).toBe('PSP_STATUS_MISMATCH');
    });

    it('throws NotFoundException for unknown run id', async () => {
      prismaMock.reconciliationRun.findUnique.mockResolvedValue(null);

      await expect(service.getRunById('unknown')).rejects.toThrow(NotFoundException);
    });
  });
});
