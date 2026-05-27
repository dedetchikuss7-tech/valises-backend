import { Test, TestingModule } from '@nestjs/testing';
import { DeviceTokenService } from './device-token.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  deviceToken: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('DeviceTokenService', () => {
  let service: DeviceTokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceTokenService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DeviceTokenService>(DeviceTokenService);
    jest.clearAllMocks();
  });

  it('registers a device token via upsert', async () => {
    mockPrisma.deviceToken.upsert.mockResolvedValue({});
    await service.registerToken('u1', 'tok123', 'IOS');
    expect(mockPrisma.deviceToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userId: 'u1', token: 'tok123', platform: 'IOS' }),
      }),
    );
  });

  it('unregisters a specific token', async () => {
    mockPrisma.deviceToken.deleteMany.mockResolvedValue({ count: 1 });
    await service.unregisterToken('u1', 'tok123');
    expect(mockPrisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', token: 'tok123' },
    });
  });

  it('removes all tokens for user on logout', async () => {
    mockPrisma.deviceToken.deleteMany.mockResolvedValue({ count: 3 });
    await service.unregisterAllForUser('u1');
    expect(mockPrisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
  });

  it('removes invalid token by token value', async () => {
    mockPrisma.deviceToken.deleteMany.mockResolvedValue({ count: 1 });
    await service.removeInvalidToken('bad-tok');
    expect(mockPrisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: 'bad-tok' },
    });
  });

  it('returns tokens for user', async () => {
    const tokens = [
      { id: 't1', token: 'abc', platform: 'IOS' },
      { id: 't2', token: 'xyz', platform: 'ANDROID' },
    ];
    mockPrisma.deviceToken.findMany.mockResolvedValue(tokens);
    const result = await service.getTokensForUser('u1');
    expect(result).toEqual(tokens);
    expect(mockPrisma.deviceToken.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      select: { id: true, token: true, platform: true },
    });
  });
});
