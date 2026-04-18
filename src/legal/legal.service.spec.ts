import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  LegalAcceptanceContext,
  LegalDocumentType,
  Role,
} from '@prisma/client';
import { LegalService } from './legal.service';

describe('LegalService', () => {
  let service: LegalService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    legalAcceptance: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
    },
    package: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LegalService(prismaMock as any);
  });

  it('creates a new GLOBAL acceptance when none exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user1' });
    prismaMock.legalAcceptance.findFirst.mockResolvedValue(null);
    prismaMock.legalAcceptance.create.mockResolvedValue({
      id: 'legal1',
      userId: 'user1',
      documentType: LegalDocumentType.TERMS_OF_SERVICE,
      documentVersion: 'v1',
      context: LegalAcceptanceContext.GLOBAL,
    });

    const result = await service.recordAcceptance('user1', {
      documentType: LegalDocumentType.TERMS_OF_SERVICE,
      documentVersion: 'v1',
      context: LegalAcceptanceContext.GLOBAL,
    });

    expect(prismaMock.legalAcceptance.create).toHaveBeenCalledWith({
      data: {
        userId: 'user1',
        documentType: LegalDocumentType.TERMS_OF_SERVICE,
        documentVersion: 'v1',
        context: LegalAcceptanceContext.GLOBAL,
        transactionId: null,
        packageId: null,
        metadata: undefined,
      },
    });

    expect(result).toEqual({
      id: 'legal1',
      userId: 'user1',
      documentType: LegalDocumentType.TERMS_OF_SERVICE,
      documentVersion: 'v1',
      context: LegalAcceptanceContext.GLOBAL,
    });
  });

  it('reuses an existing acceptance when same version/context already exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user1' });
    prismaMock.legalAcceptance.findFirst.mockResolvedValue({
      id: 'legal-existing',
      userId: 'user1',
    });

    const result = await service.recordAcceptance('user1', {
      documentType: LegalDocumentType.TERMS_OF_SERVICE,
      documentVersion: 'v1',
      context: LegalAcceptanceContext.GLOBAL,
    });

    expect(prismaMock.legalAcceptance.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 'legal-existing',
      userId: 'user1',
    });
  });

  it('throws when user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      service.recordAcceptance('missing-user', {
        documentType: LegalDocumentType.TERMS_OF_SERVICE,
        documentVersion: 'v1',
        context: LegalAcceptanceContext.GLOBAL,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws on invalid GLOBAL context payload', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user1' });

    await expect(
      service.recordAcceptance('user1', {
        documentType: LegalDocumentType.TERMS_OF_SERVICE,
        documentVersion: 'v1',
        context: LegalAcceptanceContext.GLOBAL,
        transactionId: '11111111-1111-1111-1111-111111111111',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws on invalid TRANSACTION context payload without transactionId', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user1' });

    await expect(
      service.recordAcceptance('user1', {
        documentType: LegalDocumentType.PLATFORM_ROLE_NOTICE,
        documentVersion: 'v1',
        context: LegalAcceptanceContext.TRANSACTION,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws on invalid PACKAGE context payload without packageId', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user1' });

    await expect(
      service.recordAcceptance('user1', {
        documentType: LegalDocumentType.PROHIBITED_ITEMS_NOTICE,
        documentVersion: 'v1',
        context: LegalAcceptanceContext.PACKAGE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a TRANSACTION acceptance when transaction is accessible', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user1' });
    prismaMock.transaction.findFirst.mockResolvedValue({ id: 'tx1' });
    prismaMock.legalAcceptance.findFirst.mockResolvedValue(null);
    prismaMock.legalAcceptance.create.mockResolvedValue({
      id: 'legal-tx1',
      transactionId: 'tx1',
    });

    const result = await service.recordAcceptance('user1', {
      documentType: LegalDocumentType.PLATFORM_ROLE_NOTICE,
      documentVersion: 'v1',
      context: LegalAcceptanceContext.TRANSACTION,
      transactionId: 'tx1',
    });

    expect(prismaMock.transaction.findFirst).toHaveBeenCalled();
    expect(result).toEqual({
      id: 'legal-tx1',
      transactionId: 'tx1',
    });
  });

  it('throws when transaction is not accessible for USER', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user1' });
    prismaMock.transaction.findFirst.mockResolvedValue(null);

    await expect(
      service.recordAcceptance('user1', {
        documentType: LegalDocumentType.PLATFORM_ROLE_NOTICE,
        documentVersion: 'v1',
        context: LegalAcceptanceContext.TRANSACTION,
        transactionId: 'tx-denied',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a PACKAGE acceptance when package is accessible', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user1' });
    prismaMock.package.findFirst.mockResolvedValue({ id: 'pkg1' });
    prismaMock.legalAcceptance.findFirst.mockResolvedValue(null);
    prismaMock.legalAcceptance.create.mockResolvedValue({
      id: 'legal-pkg1',
      packageId: 'pkg1',
    });

    const result = await service.recordAcceptance('user1', {
      documentType: LegalDocumentType.PROHIBITED_ITEMS_NOTICE,
      documentVersion: 'v1',
      context: LegalAcceptanceContext.PACKAGE,
      packageId: 'pkg1',
    });

    expect(prismaMock.package.findFirst).toHaveBeenCalled();
    expect(result).toEqual({
      id: 'legal-pkg1',
      packageId: 'pkg1',
    });
  });

  it('lists my acceptances ordered by acceptedAt desc then createdAt desc', async () => {
    prismaMock.legalAcceptance.findMany.mockResolvedValue([{ id: 'legal1' }]);

    const result = await service.listMyAcceptances('user1');

    expect(prismaMock.legalAcceptance.findMany).toHaveBeenCalledWith({
      where: { userId: 'user1' },
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
    });

    expect(result).toEqual([{ id: 'legal1' }]);
  });

  it('lists acceptances with filters', async () => {
    prismaMock.legalAcceptance.findMany.mockResolvedValue([{ id: 'legal2' }]);

    const result = await service.listAcceptances({
      userId: 'user1',
      documentType: LegalDocumentType.TERMS_OF_SERVICE,
      context: LegalAcceptanceContext.GLOBAL,
      transactionId: undefined,
      packageId: undefined,
      limit: 10,
    });

    expect(prismaMock.legalAcceptance.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user1',
        documentType: LegalDocumentType.TERMS_OF_SERVICE,
        context: LegalAcceptanceContext.GLOBAL,
        transactionId: undefined,
        packageId: undefined,
      },
      orderBy: [{ acceptedAt: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });

    expect(result).toEqual([{ id: 'legal2' }]);
  });

  it('acknowledges transaction platform role with actor role metadata', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user1' });
    prismaMock.transaction.findFirst.mockResolvedValue({ id: 'tx1' });
    prismaMock.legalAcceptance.findFirst.mockResolvedValue(null);
    prismaMock.legalAcceptance.create.mockResolvedValue({
      id: 'legal-platform-role',
      documentType: LegalDocumentType.PLATFORM_ROLE_NOTICE,
    });

    const result = await service.acknowledgeTransactionPlatformRole(
      'user1',
      Role.USER,
      'tx1',
    );

    expect(prismaMock.legalAcceptance.create).toHaveBeenCalledWith({
      data: {
        userId: 'user1',
        documentType: LegalDocumentType.PLATFORM_ROLE_NOTICE,
        documentVersion: 'v1',
        context: LegalAcceptanceContext.TRANSACTION,
        transactionId: 'tx1',
        packageId: null,
        metadata: {
          source: 'transaction_acknowledge_platform_role',
          actorRole: Role.USER,
        },
      },
    });

    expect(result).toEqual({
      id: 'legal-platform-role',
      documentType: LegalDocumentType.PLATFORM_ROLE_NOTICE,
    });
  });

  it('acknowledges package rules with actor role metadata', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user1' });
    prismaMock.package.findFirst.mockResolvedValue({ id: 'pkg1' });
    prismaMock.legalAcceptance.findFirst.mockResolvedValue(null);
    prismaMock.legalAcceptance.create.mockResolvedValue({
      id: 'legal-package-rules',
      documentType: LegalDocumentType.PROHIBITED_ITEMS_NOTICE,
    });

    const result = await service.acknowledgePackageRules(
      'user1',
      Role.USER,
      'pkg1',
    );

    expect(prismaMock.legalAcceptance.create).toHaveBeenCalledWith({
      data: {
        userId: 'user1',
        documentType: LegalDocumentType.PROHIBITED_ITEMS_NOTICE,
        documentVersion: 'v1',
        context: LegalAcceptanceContext.PACKAGE,
        transactionId: null,
        packageId: 'pkg1',
        metadata: {
          source: 'package_acknowledge_rules',
          actorRole: Role.USER,
        },
      },
    });

    expect(result).toEqual({
      id: 'legal-package-rules',
      documentType: LegalDocumentType.PROHIBITED_ITEMS_NOTICE,
    });
  });
});