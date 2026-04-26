import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AbandonmentKind,
  CurrencyCode,
  PackageContentCategory,
  PackageContentComplianceStatus,
  PackageStatus,
  Role,
  TransactionStatus,
} from '@prisma/client';
import { PackageService } from './package.service';

describe('PackageService', () => {
  let service: PackageService;

  const prismaMock = {
    package: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
    },
  };

  const abandonmentMock = {
    markAbandoned: jest.fn(),
    resolveActiveByReference: jest.fn(),
  };

  const enforcementMock = {
    assertPackagePublishAllowed: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    abandonmentMock.markAbandoned.mockResolvedValue(undefined);
    abandonmentMock.resolveActiveByReference.mockResolvedValue(undefined);
    enforcementMock.assertPackagePublishAllowed.mockResolvedValue(undefined);

    service = new PackageService(
      prismaMock as any,
      abandonmentMock as any,
      enforcementMock as any,
    );
  });

  it('creates a package draft and marks package draft abandonment', async () => {
    prismaMock.package.create.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
      corridorId: 'corridor-1',
      weightKg: 10,
      description: 'Test package',
      status: PackageStatus.DRAFT,
    });

    const result = await service.createDraft('sender-1', {
      corridorId: 'corridor-1',
      weightKg: 10,
      description: 'Test package',
    });

    expect(prismaMock.package.create).toHaveBeenCalledWith({
      data: {
        senderId: 'sender-1',
        corridorId: 'corridor-1',
        weightKg: 10,
        description: 'Test package',
        status: 'DRAFT',
      },
    });

    expect(abandonmentMock.markAbandoned).toHaveBeenCalledWith(
      { userId: 'sender-1', role: 'USER' },
      {
        kind: AbandonmentKind.PACKAGE_DRAFT,
        packageId: 'pkg-1',
        metadata: {
          step: 'draft_created',
          corridorId: 'corridor-1',
        },
      },
    );

    expect(result.id).toBe('pkg-1');
  });

  it('declares clear package content', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
      status: PackageStatus.DRAFT,
    });

    prismaMock.package.update.mockResolvedValue({
      id: 'pkg-1',
      contentComplianceStatus: PackageContentComplianceStatus.DECLARED_CLEAR,
    });

    const result = await service.declareContent(
      'sender-1',
      Role.USER,
      'pkg-1',
      {
        contentCategory: PackageContentCategory.CLOTHING,
        contentSummary: 'Clothes and shoes',
        declaredItemCount: 4,
        declaredValueAmount: 120,
        declaredValueCurrency: CurrencyCode.EUR,
        containsFragileItems: false,
        containsLiquid: false,
        containsElectronic: false,
        containsBattery: false,
        containsMedicine: false,
        containsPerishableItems: false,
        containsValuableItems: false,
        containsDocuments: false,
        containsProhibitedItems: false,
        prohibitedItemsDeclarationAccepted: true,
      },
    );

    expect(prismaMock.package.update).toHaveBeenCalledWith({
      where: { id: 'pkg-1' },
      data: expect.objectContaining({
        contentCategory: PackageContentCategory.CLOTHING,
        contentSummary: 'Clothes and shoes',
        declaredItemCount: 4,
        declaredValueAmount: 120,
        declaredValueCurrency: CurrencyCode.EUR,
        containsProhibitedItems: false,
        contentComplianceStatus:
          PackageContentComplianceStatus.DECLARED_CLEAR,
        contentComplianceNotes: 'No prohibited content declared by sender.',
        contentDeclaredById: 'sender-1',
        prohibitedItemsDeclarationAcceptedById: 'sender-1',
      }),
    });

    expect(result.contentComplianceStatus).toBe(
      PackageContentComplianceStatus.DECLARED_CLEAR,
    );
  });

  it('marks content as sensitive when sensitive signals are declared', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
      status: PackageStatus.DRAFT,
    });

    prismaMock.package.update.mockResolvedValue({
      id: 'pkg-1',
      contentComplianceStatus:
        PackageContentComplianceStatus.DECLARED_SENSITIVE,
    });

    await service.declareContent('sender-1', Role.USER, 'pkg-1', {
      contentCategory: PackageContentCategory.ELECTRONICS,
      contentSummary: 'Laptop and charger',
      containsFragileItems: true,
      containsLiquid: false,
      containsElectronic: true,
      containsBattery: true,
      containsMedicine: false,
      containsPerishableItems: false,
      containsValuableItems: true,
      containsDocuments: false,
      containsProhibitedItems: false,
      prohibitedItemsDeclarationAccepted: true,
    });

    expect(prismaMock.package.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contentComplianceStatus:
            PackageContentComplianceStatus.DECLARED_SENSITIVE,
          contentComplianceNotes:
            'Sensitive content declared: manual review may be required later.',
        }),
      }),
    );
  });

  it('blocks content when prohibited items are declared', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
      status: PackageStatus.DRAFT,
    });

    prismaMock.package.update.mockResolvedValue({
      id: 'pkg-1',
      contentComplianceStatus: PackageContentComplianceStatus.BLOCKED,
    });

    await service.declareContent('sender-1', Role.USER, 'pkg-1', {
      contentCategory: PackageContentCategory.OTHER,
      contentSummary: 'Declared prohibited content',
      containsProhibitedItems: true,
      prohibitedItemsDeclarationAccepted: true,
    });

    expect(prismaMock.package.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          containsProhibitedItems: true,
          contentComplianceStatus: PackageContentComplianceStatus.BLOCKED,
        }),
      }),
    );
  });

  it('rejects content declaration when prohibited items acknowledgement is false', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
      status: PackageStatus.DRAFT,
    });

    await expect(
      service.declareContent('sender-1', Role.USER, 'pkg-1', {
        contentCategory: PackageContentCategory.CLOTHING,
        contentSummary: 'Clothes',
        containsProhibitedItems: false,
        prohibitedItemsDeclarationAccepted: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects content declaration by outsider user', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
      status: PackageStatus.DRAFT,
    });

    await expect(
      service.declareContent('outsider-1', Role.USER, 'pkg-1', {
        contentCategory: PackageContentCategory.CLOTHING,
        contentSummary: 'Clothes',
        containsProhibitedItems: false,
        prohibitedItemsDeclarationAccepted: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows admin to review declared package content', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      status: PackageStatus.PUBLISHED,
      contentDeclaredAt: new Date('2026-04-26T10:00:00.000Z'),
      contentComplianceStatus:
        PackageContentComplianceStatus.DECLARED_SENSITIVE,
    });

    prismaMock.package.update.mockResolvedValue({
      id: 'pkg-1',
      contentComplianceStatus: PackageContentComplianceStatus.DECLARED_CLEAR,
      contentComplianceNotes: 'Admin reviewed and cleared.',
    });

    const result = await service.reviewContent(
      'admin-1',
      Role.ADMIN,
      'pkg-1',
      {
        contentComplianceStatus: PackageContentComplianceStatus.DECLARED_CLEAR,
        contentComplianceNotes: 'Admin reviewed and cleared.',
      },
    );

    expect(prismaMock.package.update).toHaveBeenCalledWith({
      where: { id: 'pkg-1' },
      data: {
        contentComplianceStatus: PackageContentComplianceStatus.DECLARED_CLEAR,
        contentComplianceNotes: 'Admin reviewed and cleared.',
      },
    });

    expect(result.contentComplianceStatus).toBe(
      PackageContentComplianceStatus.DECLARED_CLEAR,
    );
  });

  it('rejects package content review by non-admin', async () => {
    await expect(
      service.reviewContent('sender-1', Role.USER, 'pkg-1', {
        contentComplianceStatus: PackageContentComplianceStatus.DECLARED_CLEAR,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.package.findUnique).not.toHaveBeenCalled();
  });

  it('rejects admin review reset to NOT_DECLARED', async () => {
    await expect(
      service.reviewContent('admin-1', Role.ADMIN, 'pkg-1', {
        contentComplianceStatus: PackageContentComplianceStatus.NOT_DECLARED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.package.findUnique).not.toHaveBeenCalled();
  });

  it('rejects admin review when content has not been declared', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      status: PackageStatus.DRAFT,
      contentDeclaredAt: null,
      contentComplianceStatus: PackageContentComplianceStatus.NOT_DECLARED,
    });

    await expect(
      service.reviewContent('admin-1', Role.ADMIN, 'pkg-1', {
        contentComplianceStatus: PackageContentComplianceStatus.DECLARED_CLEAR,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('publishes a declared clear draft package', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
      status: PackageStatus.DRAFT,
      contentComplianceStatus:
        PackageContentComplianceStatus.DECLARED_CLEAR,
    });

    prismaMock.package.update.mockResolvedValue({
      id: 'pkg-1',
      status: PackageStatus.PUBLISHED,
    });

    const result = await service.publish('sender-1', 'pkg-1');

    expect(enforcementMock.assertPackagePublishAllowed).toHaveBeenCalledWith({
      userId: 'sender-1',
      packageId: 'pkg-1',
    });

    expect(prismaMock.package.update).toHaveBeenCalledWith({
      where: { id: 'pkg-1' },
      data: { status: 'PUBLISHED' },
    });

    expect(abandonmentMock.resolveActiveByReference).toHaveBeenCalledWith({
      userId: 'sender-1',
      kind: AbandonmentKind.PACKAGE_DRAFT,
      packageId: 'pkg-1',
    });

    expect(result.status).toBe(PackageStatus.PUBLISHED);
  });

  it('rejects publishing when content is not declared', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
      status: PackageStatus.DRAFT,
      contentComplianceStatus: PackageContentComplianceStatus.NOT_DECLARED,
    });

    await expect(service.publish('sender-1', 'pkg-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prismaMock.package.update).not.toHaveBeenCalled();
  });

  it('rejects publishing when content is blocked', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
      status: PackageStatus.DRAFT,
      contentComplianceStatus: PackageContentComplianceStatus.BLOCKED,
    });

    await expect(service.publish('sender-1', 'pkg-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prismaMock.package.update).not.toHaveBeenCalled();
  });

  it('cancels a draft package', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
      status: PackageStatus.DRAFT,
    });

    prismaMock.package.update.mockResolvedValue({
      id: 'pkg-1',
      status: PackageStatus.CANCELLED,
    });

    const result = await service.cancel('sender-1', 'pkg-1');

    expect(prismaMock.package.update).toHaveBeenCalledWith({
      where: { id: 'pkg-1' },
      data: { status: 'CANCELLED' },
    });

    expect(result.status).toBe(PackageStatus.CANCELLED);
  });

  it('declares package handover by sender', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
      status: PackageStatus.PUBLISHED,
      handoverDeclaredAt: null,
      handoverDeclaredById: null,
      handoverNotes: null,
    });

    prismaMock.package.update.mockResolvedValue({
      id: 'pkg-1',
      handoverDeclaredById: 'sender-1',
    });

    const result = await service.declareHandover(
      'sender-1',
      Role.USER,
      'pkg-1',
      'Package handed over',
    );

    expect(prismaMock.package.update).toHaveBeenCalledWith({
      where: { id: 'pkg-1' },
      data: expect.objectContaining({
        handoverDeclaredById: 'sender-1',
        handoverNotes: 'Package handed over',
      }),
    });

    expect(result.handoverDeclaredById).toBe('sender-1');
  });

  it('acknowledges traveler responsibility for linked active transaction', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      status: PackageStatus.RESERVED,
    });

    prismaMock.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      travelerId: 'traveler-1',
    });

    prismaMock.package.update.mockResolvedValue({
      id: 'pkg-1',
      travelerResponsibilityAcknowledgedById: 'traveler-1',
    });

    const result = await service.acknowledgeTravelerResponsibility(
      'traveler-1',
      Role.USER,
      'pkg-1',
    );

    expect(prismaMock.transaction.findFirst).toHaveBeenCalledWith({
      where: {
        packageId: 'pkg-1',
        NOT: { status: TransactionStatus.CANCELLED },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        travelerId: true,
      },
    });

    expect(result.travelerResponsibilityAcknowledgedById).toBe('traveler-1');
  });

  it('throws NotFoundException when package is missing', async () => {
    prismaMock.package.findUnique.mockResolvedValue(null);

    await expect(service.publish('sender-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});