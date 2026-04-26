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
import {
  PackageHandoverStatus,
  PackageOperationalReadinessStatus,
  PackageTravelerResponsibilityStatus,
} from './dto/package-operational-status.dto';

describe('PackageService', () => {
  let service: PackageService;

  const now = new Date('2026-04-26T10:00:00.000Z');

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

  const basePackage = {
    id: 'pkg-1',
    senderId: 'sender-1',
    corridorId: 'corridor-1',
    weightKg: 10,
    description: 'Test package',
    status: PackageStatus.DRAFT,
    contentCategory: null,
    contentSummary: null,
    declaredItemCount: null,
    declaredValueAmount: null,
    declaredValueCurrency: null,
    containsFragileItems: false,
    containsLiquid: false,
    containsElectronic: false,
    containsBattery: false,
    containsMedicine: false,
    containsPerishableItems: false,
    containsValuableItems: false,
    containsDocuments: false,
    containsProhibitedItems: false,
    prohibitedItemsDeclarationAcceptedAt: null,
    prohibitedItemsDeclarationAcceptedById: null,
    contentDeclaredAt: null,
    contentDeclaredById: null,
    contentComplianceStatus: PackageContentComplianceStatus.NOT_DECLARED,
    contentComplianceNotes: null,
    handoverDeclaredAt: null,
    handoverDeclaredById: null,
    handoverNotes: null,
    travelerResponsibilityAcknowledgedAt: null,
    travelerResponsibilityAcknowledgedById: null,
    createdAt: now,
    updatedAt: now,
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

  it('creates a package draft and returns operational readiness signals', async () => {
    prismaMock.package.create.mockResolvedValue(basePackage);

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
        status: PackageStatus.DRAFT,
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

    expect(result.packageOperationalReadiness).toBe(
      PackageOperationalReadinessStatus.DRAFT_INCOMPLETE,
    );
    expect(result.handoverStatus).toBe(PackageHandoverStatus.NOT_DECLARED);
    expect(result.travelerResponsibilityStatus).toBe(
      PackageTravelerResponsibilityStatus.NOT_APPLICABLE,
    );
  });

  it('declares clear package content and marks package ready to publish while still draft', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
      status: PackageStatus.DRAFT,
    });

    prismaMock.package.update.mockResolvedValue({
      ...basePackage,
      contentCategory: PackageContentCategory.CLOTHING,
      contentSummary: 'Clothes and shoes',
      declaredItemCount: 4,
      declaredValueAmount: 120,
      declaredValueCurrency: CurrencyCode.EUR,
      contentDeclaredAt: now,
      contentDeclaredById: 'sender-1',
      prohibitedItemsDeclarationAcceptedAt: now,
      prohibitedItemsDeclarationAcceptedById: 'sender-1',
      contentComplianceStatus: PackageContentComplianceStatus.DECLARED_CLEAR,
      contentComplianceNotes: 'No prohibited content declared by sender.',
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

    expect(result.contentComplianceStatus).toBe(
      PackageContentComplianceStatus.DECLARED_CLEAR,
    );
    expect(result.declaredValueAmount).toBe(120);
    expect(result.packageOperationalReadiness).toBe(
      PackageOperationalReadinessStatus.READY_TO_PUBLISH,
    );
  });

  it('marks content as sensitive when sensitive signals are declared', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
      status: PackageStatus.DRAFT,
    });

    prismaMock.package.update.mockResolvedValue({
      ...basePackage,
      contentCategory: PackageContentCategory.ELECTRONICS,
      contentSummary: 'Laptop and charger',
      containsElectronic: true,
      containsBattery: true,
      containsValuableItems: true,
      contentDeclaredAt: now,
      contentComplianceStatus:
        PackageContentComplianceStatus.DECLARED_SENSITIVE,
      contentComplianceNotes:
        'Sensitive content declared: manual review may be required later.',
    });

    const result = await service.declareContent(
      'sender-1',
      Role.USER,
      'pkg-1',
      {
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
      },
    );

    expect(result.contentComplianceStatus).toBe(
      PackageContentComplianceStatus.DECLARED_SENSITIVE,
    );
    expect(result.packageOperationalReadiness).toBe(
      PackageOperationalReadinessStatus.READY_TO_PUBLISH,
    );
  });

  it('blocks content when prohibited items are declared', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
      status: PackageStatus.DRAFT,
    });

    prismaMock.package.update.mockResolvedValue({
      ...basePackage,
      containsProhibitedItems: true,
      contentDeclaredAt: now,
      contentComplianceStatus: PackageContentComplianceStatus.BLOCKED,
    });

    const result = await service.declareContent(
      'sender-1',
      Role.USER,
      'pkg-1',
      {
        contentCategory: PackageContentCategory.OTHER,
        contentSummary: 'Declared prohibited content',
        containsProhibitedItems: true,
        prohibitedItemsDeclarationAccepted: true,
      },
    );

    expect(result.contentComplianceStatus).toBe(
      PackageContentComplianceStatus.BLOCKED,
    );
    expect(result.packageOperationalReadiness).toBe(
      PackageOperationalReadinessStatus.BLOCKED_CONTENT,
    );
  });

  it('allows admin to review declared package content', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      status: PackageStatus.PUBLISHED,
      contentDeclaredAt: now,
      contentComplianceStatus:
        PackageContentComplianceStatus.DECLARED_SENSITIVE,
    });

    prismaMock.package.update.mockResolvedValue({
      ...basePackage,
      status: PackageStatus.PUBLISHED,
      contentDeclaredAt: now,
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

    expect(result.contentComplianceStatus).toBe(
      PackageContentComplianceStatus.DECLARED_CLEAR,
    );
    expect(result.packageOperationalReadiness).toBe(
      PackageOperationalReadinessStatus.PUBLISHED_WAITING_MATCH,
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

  it('publishes a declared clear draft package and returns published waiting match readiness', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      ...basePackage,
      contentDeclaredAt: now,
      contentComplianceStatus: PackageContentComplianceStatus.DECLARED_CLEAR,
    });

    prismaMock.package.update.mockResolvedValue({
      ...basePackage,
      status: PackageStatus.PUBLISHED,
      contentDeclaredAt: now,
      contentComplianceStatus: PackageContentComplianceStatus.DECLARED_CLEAR,
    });

    const result = await service.publish('sender-1', 'pkg-1');

    expect(enforcementMock.assertPackagePublishAllowed).toHaveBeenCalledWith({
      userId: 'sender-1',
      packageId: 'pkg-1',
    });

    expect(result.status).toBe(PackageStatus.PUBLISHED);
    expect(result.packageOperationalReadiness).toBe(
      PackageOperationalReadinessStatus.PUBLISHED_WAITING_MATCH,
    );
  });

  it('rejects publishing when content is not declared', async () => {
    prismaMock.package.findUnique.mockResolvedValue(basePackage);

    await expect(service.publish('sender-1', 'pkg-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prismaMock.package.update).not.toHaveBeenCalled();
  });

  it('rejects publishing when content is blocked', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      ...basePackage,
      contentComplianceStatus: PackageContentComplianceStatus.BLOCKED,
    });

    await expect(service.publish('sender-1', 'pkg-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prismaMock.package.update).not.toHaveBeenCalled();
  });

  it('declares package handover for reserved package with declared content', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
      status: PackageStatus.RESERVED,
      contentComplianceStatus: PackageContentComplianceStatus.DECLARED_CLEAR,
      handoverDeclaredAt: null,
      handoverDeclaredById: null,
      handoverNotes: null,
    });

    prismaMock.package.update.mockResolvedValue({
      ...basePackage,
      status: PackageStatus.RESERVED,
      contentDeclaredAt: now,
      contentComplianceStatus: PackageContentComplianceStatus.DECLARED_CLEAR,
      handoverDeclaredAt: now,
      handoverDeclaredById: 'sender-1',
      handoverNotes: 'Package handed over',
    });

    const result = await service.declareHandover(
      'sender-1',
      Role.USER,
      'pkg-1',
      'Package handed over',
    );

    expect(result.handoverStatus).toBe(PackageHandoverStatus.DECLARED);
    expect(result.packageOperationalReadiness).toBe(
      PackageOperationalReadinessStatus.RESERVED_WAITING_TRAVELER_ACK,
    );
  });

  it('keeps handover optional while waiting for traveler responsibility acknowledgement', async () => {
    const reservedPackage = {
      ...basePackage,
      status: PackageStatus.RESERVED,
      contentDeclaredAt: now,
      contentComplianceStatus: PackageContentComplianceStatus.DECLARED_CLEAR,
      handoverDeclaredAt: null,
      travelerResponsibilityAcknowledgedAt: null,
    };

    prismaMock.package.findMany.mockResolvedValue([reservedPackage]);

    const result = await service.findMine('sender-1');

    expect(result[0].handoverStatus).toBe(PackageHandoverStatus.NOT_DECLARED);
    expect(result[0].travelerResponsibilityStatus).toBe(
      PackageTravelerResponsibilityStatus.PENDING,
    );
    expect(result[0].packageOperationalReadiness).toBe(
      PackageOperationalReadinessStatus.RESERVED_WAITING_TRAVELER_ACK,
    );
  });

  it('rejects handover when content is not declared', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
      status: PackageStatus.RESERVED,
      contentComplianceStatus: PackageContentComplianceStatus.NOT_DECLARED,
      handoverDeclaredAt: null,
      handoverDeclaredById: null,
      handoverNotes: null,
    });

    await expect(
      service.declareHandover('sender-1', Role.USER, 'pkg-1', 'handover'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects handover when content is blocked', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      senderId: 'sender-1',
      status: PackageStatus.RESERVED,
      contentComplianceStatus: PackageContentComplianceStatus.BLOCKED,
      handoverDeclaredAt: null,
      handoverDeclaredById: null,
      handoverNotes: null,
    });

    await expect(
      service.declareHandover('sender-1', Role.USER, 'pkg-1', 'handover'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acknowledges traveler responsibility without requiring handover declaration', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      status: PackageStatus.RESERVED,
      contentComplianceStatus: PackageContentComplianceStatus.DECLARED_CLEAR,
    });

    prismaMock.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      travelerId: 'traveler-1',
    });

    prismaMock.package.update.mockResolvedValue({
      ...basePackage,
      status: PackageStatus.RESERVED,
      contentDeclaredAt: now,
      contentComplianceStatus: PackageContentComplianceStatus.DECLARED_CLEAR,
      handoverDeclaredAt: null,
      handoverDeclaredById: null,
      travelerResponsibilityAcknowledgedAt: now,
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

    expect(result.handoverStatus).toBe(PackageHandoverStatus.NOT_DECLARED);
    expect(result.travelerResponsibilityStatus).toBe(
      PackageTravelerResponsibilityStatus.ACKNOWLEDGED,
    );
    expect(result.packageOperationalReadiness).toBe(
      PackageOperationalReadinessStatus.READY_FOR_TRANSPORT,
    );
  });

  it('rejects traveler acknowledgement when content is blocked', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg-1',
      status: PackageStatus.RESERVED,
      contentComplianceStatus: PackageContentComplianceStatus.BLOCKED,
    });

    await expect(
      service.acknowledgeTravelerResponsibility(
        'traveler-1',
        Role.USER,
        'pkg-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.transaction.findFirst).not.toHaveBeenCalled();
  });

  it('cancels a draft package and returns cancelled readiness', async () => {
    prismaMock.package.findUnique.mockResolvedValue(basePackage);

    prismaMock.package.update.mockResolvedValue({
      ...basePackage,
      status: PackageStatus.CANCELLED,
    });

    const result = await service.cancel('sender-1', 'pkg-1');

    expect(result.status).toBe(PackageStatus.CANCELLED);
    expect(result.packageOperationalReadiness).toBe(
      PackageOperationalReadinessStatus.CANCELLED,
    );
  });

  it('returns my packages with operational readiness signals', async () => {
    prismaMock.package.findMany.mockResolvedValue([
      {
        ...basePackage,
        status: PackageStatus.PUBLISHED,
        contentDeclaredAt: now,
        contentComplianceStatus: PackageContentComplianceStatus.DECLARED_CLEAR,
      },
    ]);

    const result = await service.findMine('sender-1');

    expect(result).toHaveLength(1);
    expect(result[0].packageOperationalReadiness).toBe(
      PackageOperationalReadinessStatus.PUBLISHED_WAITING_MATCH,
    );
  });

  it('throws NotFoundException when package is missing', async () => {
    prismaMock.package.findUnique.mockResolvedValue(null);

    await expect(service.publish('sender-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});