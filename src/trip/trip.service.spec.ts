import { Test, TestingModule } from '@nestjs/testing';
import { TripService } from './trip.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TripService', () => {
  let service: TripService;

  const prismaMock = {
    trip: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    package: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
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
        TripService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<TripService>(TripService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});