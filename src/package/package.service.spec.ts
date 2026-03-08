import { Test, TestingModule } from '@nestjs/testing';
import { PackageService } from './package.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PackageService', () => {
  let service: PackageService;

  const prismaMock = {
    package: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    trip: {
      findUnique: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
    },
    corridor: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(prismaMock)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackageService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<PackageService>(PackageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});