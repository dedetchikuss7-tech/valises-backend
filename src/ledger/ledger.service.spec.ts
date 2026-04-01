import { BadRequestException } from '@nestjs/common';
import { LedgerEntryType } from '@prisma/client';
import { LedgerService } from './ledger.service';

function makePrismaMock(initialEntries: any[] = []) {
  const entries = [...initialEntries];

  return {
    ledgerEntry: {
      findMany: jest.fn(async ({ where }: any) => {
        return entries.filter((e) => e.transactionId === where.transactionId);
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const key = where.transactionId_idempotencyKey;
        return (
          entries.find(
            (e) =>
              e.transactionId === key.transactionId &&
              e.idempotencyKey === key.idempotencyKey,
          ) ?? null
        );
      }),
      create: jest.fn(async ({ data }: any) => {
        const created = {
          id: `id_${entries.length + 1}`,
          createdAt: new Date(),
          ...data,
        };
        entries.push(created);
        return created;
      }),
    },
    $transaction: jest.fn(async (fn: any) => fn({ ledgerEntry: null as any })),
  };
}

describe('LedgerService (hardening)', () => {
  it('rejects amount <= 0', async () => {
    const prisma: any = makePrismaMock();
    prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));

    const service = new LedgerService(prisma);

    await expect(
      service.addEntryIdempotent({
        transactionId: 'tx1',
        type: LedgerEntryType.ESCROW_CREDIT,
        amount: 0,
        idempotencyKey: 'k',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('idempotent write returns existing entry', async () => {
    const prisma: any = makePrismaMock([
      {
        id: 'e1',
        transactionId: 'tx1',
        type: LedgerEntryType.ESCROW_CREDIT,
        amount: 1000,
        currency: 'EUR',
        idempotencyKey: 'key1',
      },
    ]);
    prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));

    const service = new LedgerService(prisma);

    const result = await service.addEntryIdempotent({
      transactionId: 'tx1',
      type: LedgerEntryType.ESCROW_CREDIT,
      amount: 1000,
      idempotencyKey: 'key1',
    });

    expect(result.id).toBe('e1');
    expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
  });

  it('prevents escrow debit above balance', async () => {
    const prisma: any = makePrismaMock([
      {
        id: 'c1',
        transactionId: 'tx1',
        type: LedgerEntryType.ESCROW_CREDIT,
        amount: 1000,
        currency: 'EUR',
        idempotencyKey: 'pay:1',
      },
    ]);
    prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));

    const service = new LedgerService(prisma);

    await expect(
      service.addEntryIdempotent({
        transactionId: 'tx1',
        type: LedgerEntryType.ESCROW_DEBIT_RELEASE,
        amount: 2000,
        idempotencyKey: 'release:1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows escrow debit within balance', async () => {
    const prisma: any = makePrismaMock([
      {
        id: 'c1',
        transactionId: 'tx1',
        type: LedgerEntryType.ESCROW_CREDIT,
        amount: 1000,
        currency: 'EUR',
        idempotencyKey: 'pay:1',
      },
    ]);
    prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));

    const service = new LedgerService(prisma);

    const result = await service.addEntryIdempotent({
      transactionId: 'tx1',
      type: LedgerEntryType.ESCROW_DEBIT_RELEASE,
      amount: 600,
      idempotencyKey: 'release:1',
    });

    expect(result.type).toBe(LedgerEntryType.ESCROW_DEBIT_RELEASE);
    expect(prisma.ledgerEntry.create).toHaveBeenCalledTimes(1);
  });

  it('computes separated balances and releasable amount', async () => {
    const prisma: any = makePrismaMock([
      {
        id: 'e1',
        transactionId: 'tx1',
        type: LedgerEntryType.ESCROW_CREDIT,
        amount: 1000,
        currency: 'EUR',
        idempotencyKey: 'pay:1',
      },
      {
        id: 'e2',
        transactionId: 'tx1',
        type: LedgerEntryType.COMMISSION_ACCRUAL,
        amount: 100,
        currency: 'EUR',
        idempotencyKey: 'commission:1',
      },
      {
        id: 'e3',
        transactionId: 'tx1',
        type: LedgerEntryType.RESERVE_CREDIT,
        amount: 50,
        currency: 'EUR',
        idempotencyKey: 'reserve:1',
      },
    ]);
    prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));

    const service = new LedgerService(prisma);

    const balances = await service.getBalances('tx1');

    expect(balances).toEqual({
      escrowBalance: 1000,
      commissionBalance: 100,
      reserveBalance: 50,
      releasableAmount: 850,
    });
  });

  it('prevents commission reversal above commission balance', async () => {
    const prisma: any = makePrismaMock([
      {
        id: 'e1',
        transactionId: 'tx1',
        type: LedgerEntryType.COMMISSION_ACCRUAL,
        amount: 100,
        currency: 'EUR',
        idempotencyKey: 'commission:1',
      },
    ]);
    prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));

    const service = new LedgerService(prisma);

    await expect(
      service.addEntryIdempotent({
        transactionId: 'tx1',
        type: LedgerEntryType.COMMISSION_REVERSAL,
        amount: 150,
        idempotencyKey: 'commission_reversal:1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents reserve debit above reserve balance', async () => {
    const prisma: any = makePrismaMock([
      {
        id: 'e1',
        transactionId: 'tx1',
        type: LedgerEntryType.RESERVE_CREDIT,
        amount: 60,
        currency: 'EUR',
        idempotencyKey: 'reserve:1',
      },
    ]);
    prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));

    const service = new LedgerService(prisma);

    await expect(
      service.addEntryIdempotent({
        transactionId: 'tx1',
        type: LedgerEntryType.RESERVE_DEBIT,
        amount: 80,
        idempotencyKey: 'reserve_debit:1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows reserve debit within reserve balance', async () => {
    const prisma: any = makePrismaMock([
      {
        id: 'e1',
        transactionId: 'tx1',
        type: LedgerEntryType.RESERVE_CREDIT,
        amount: 60,
        currency: 'EUR',
        idempotencyKey: 'reserve:1',
      },
    ]);
    prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));

    const service = new LedgerService(prisma);

    const result = await service.addEntryIdempotent({
      transactionId: 'tx1',
      type: LedgerEntryType.RESERVE_DEBIT,
      amount: 40,
      idempotencyKey: 'reserve_debit:1',
    });

    expect(result.type).toBe(LedgerEntryType.RESERVE_DEBIT);
    expect(prisma.ledgerEntry.create).toHaveBeenCalledTimes(1);
  });
});