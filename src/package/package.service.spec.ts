import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import {
  CurrencyCode,
  PackageContentCategory,
  Role,
} from '@prisma/client';
import { PackageController } from './package.controller';
import { PackageService } from './package.service';

describe('PackageController', () => {
  let controller: PackageController;

  const packageServiceMock = {
    createDraft: jest.fn(),
    declareContent: jest.fn(),
    findMine: jest.fn(),
    publish: jest.fn(),
    cancel: jest.fn(),
    declareHandover: jest.fn(),
    acknowledgeTravelerResponsibility: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PackageController],
      providers: [{ provide: PackageService, useValue: packageServiceMock }],
    }).compile();

    controller = module.get<PackageController>(PackageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('calls createDraft with the authenticated user id', async () => {
    const req = {
      user: {
        userId: 'user-1',
        role: Role.USER,
      },
    };

    const dto = {
      corridorId: 'corridor-1',
      weightKg: 10,
      description: 'Test package',
    };

    await controller.create(req, dto);

    expect(packageServiceMock.createDraft).toHaveBeenCalledWith('user-1', dto);
  });

  it('calls declareContent with actor id, role, package id and dto', async () => {
    const req = {
      user: {
        userId: 'sender-1',
        role: Role.USER,
      },
    };

    const dto = {
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
    };

    await controller.declareContent(req, 'pkg-1', dto);

    expect(packageServiceMock.declareContent).toHaveBeenCalledWith(
      'sender-1',
      Role.USER,
      'pkg-1',
      dto,
    );
  });

  it('calls declareHandover with actor id, role, package id and notes', async () => {
    const req = {
      user: {
        userId: 'sender-1',
        role: Role.USER,
      },
    };

    await controller.declareHandover(req, 'pkg-1', {
      notes: 'Package handed over at meeting point A',
    });

    expect(packageServiceMock.declareHandover).toHaveBeenCalledWith(
      'sender-1',
      Role.USER,
      'pkg-1',
      'Package handed over at meeting point A',
    );
  });

  it('calls acknowledgeTravelerResponsibility with actor id, role and package id', async () => {
    const req = {
      user: {
        userId: 'traveler-1',
        role: Role.USER,
      },
    };

    await controller.acknowledgeTravelerResponsibility(req, 'pkg-1');

    expect(
      packageServiceMock.acknowledgeTravelerResponsibility,
    ).toHaveBeenCalledWith('traveler-1', Role.USER, 'pkg-1');
  });

  it('throws UnauthorizedException when auth user id is missing', () => {
    const req = {
      user: {
        role: Role.USER,
      },
    };

    expect(() => controller.mine(req)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when auth role is missing for declareContent', () => {
    const req = {
      user: {
        userId: 'sender-1',
      },
    };

    const dto = {
      contentCategory: PackageContentCategory.CLOTHING,
      contentSummary: 'Clothes and shoes',
      containsProhibitedItems: false,
      prohibitedItemsDeclarationAccepted: true,
    };

    expect(() => controller.declareContent(req, 'pkg-1', dto as any)).toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when auth role is missing for declareHandover', () => {
    const req = {
      user: {
        userId: 'sender-1',
      },
    };

    expect(() =>
      controller.declareHandover(req, 'pkg-1', { notes: 'test' }),
    ).toThrow(UnauthorizedException);
  });
});