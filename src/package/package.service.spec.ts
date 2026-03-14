import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AbandonmentKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AbandonmentService } from '../abandonment/abandonment.service';
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
  };

  const abandonmentMock = {
    markAbandoned: jest.fn(),
    resolveActiveByReference: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackageService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AbandonmentService, useValue: abandonmentMock },
      ],
    }).compile();

    service = module.get<PackageService>(PackageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create draft and mark abandonment', async () => {
    prismaMock.package.create.mockResolvedValue({
      id: 'pkg1',
      senderId: 'user1',
      corridorId: 'corr1',
      status: 'DRAFT',
    });

    abandonmentMock.markAbandoned.mockResolvedValue({
      id: 'ab1',
      kind: AbandonmentKind.PACKAGE_DRAFT,
    });

    const result = await service.createDraft('user1', {
      corridorId: 'corr1',
      weightKg: 5,
      description: 'Documents',
    });

    expect(result.id).toBe('pkg1');
    expect(prismaMock.package.create).toHaveBeenCalled();
    expect(abandonmentMock.markAbandoned).toHaveBeenCalled();
  });

  it('should publish package and resolve abandonment', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg1',
      senderId: 'user1',
      status: 'DRAFT',
    });

    prismaMock.package.update.mockResolvedValue({
      id: 'pkg1',
      senderId: 'user1',
      status: 'PUBLISHED',
    });

    abandonmentMock.resolveActiveByReference.mockResolvedValue({
      resolvedCount: 1,
    });

    const result = await service.publish('user1', 'pkg1');

    expect(result.status).toBe('PUBLISHED');
    expect(prismaMock.package.update).toHaveBeenCalled();
    expect(abandonmentMock.resolveActiveByReference).toHaveBeenCalled();
  });

  it('should throw if package not found on publish', async () => {
    prismaMock.package.findUnique.mockResolvedValue(null);

    await expect(service.publish('user1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('should throw if publish on another user package', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg1',
      senderId: 'other-user',
      status: 'DRAFT',
    });

    await expect(service.publish('user1', 'pkg1')).rejects.toThrow(ForbiddenException);
  });

  it('should throw if publish when package is not DRAFT', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg1',
      senderId: 'user1',
      status: 'RESERVED',
    });

    await expect(service.publish('user1', 'pkg1')).rejects.toThrow(BadRequestException);
  });

  it('should cancel package and resolve abandonment', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg1',
      senderId: 'user1',
      status: 'DRAFT',
    });

    prismaMock.package.update.mockResolvedValue({
      id: 'pkg1',
      senderId: 'user1',
      status: 'CANCELLED',
    });

    abandonmentMock.resolveActiveByReference.mockResolvedValue({
      resolvedCount: 1,
    });

    const result = await service.cancel('user1', 'pkg1');

    expect(result.status).toBe('CANCELLED');
    expect(prismaMock.package.update).toHaveBeenCalled();
    expect(abandonmentMock.resolveActiveByReference).toHaveBeenCalled();
  });

  it('should return package if already cancelled', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg1',
      senderId: 'user1',
      status: 'CANCELLED',
    });

    const result = await service.cancel('user1', 'pkg1');

    expect(result.status).toBe('CANCELLED');
  });

  it('should reject cancel if package is RESERVED', async () => {
    prismaMock.package.findUnique.mockResolvedValue({
      id: 'pkg1',
      senderId: 'user1',
      status: 'RESERVED',
    });

    await expect(service.cancel('user1', 'pkg1')).rejects.toThrow(BadRequestException);
  });

  it('should list user packages', async () => {
    prismaMock.package.findMany.mockResolvedValue([
      { id: 'pkg1', senderId: 'user1' },
      { id: 'pkg2', senderId: 'user1' },
    ]);

    const result = await service.findMine('user1');

    expect(result).toHaveLength(2);
    expect(prismaMock.package.findMany).toHaveBeenCalledWith({
      where: { senderId: 'user1' },
      orderBy: { createdAt: 'desc' },
    });
  });
});