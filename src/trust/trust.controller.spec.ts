import { Test, TestingModule } from '@nestjs/testing';
import { TrustController } from './trust.controller';
import { TrustService } from './trust.service';

describe('TrustController', () => {
  let controller: TrustController;

  const trustServiceMock = {
    getProfile: jest.fn(),
    recordEvent: jest.fn(),
    imposeRestriction: jest.fn(),
    releaseRestriction: jest.fn(),
    listRestrictions: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrustController],
      providers: [{ provide: TrustService, useValue: trustServiceMock }],
    }).compile();

    controller = module.get<TrustController>(TrustController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates reputation event recording to the service', async () => {
    trustServiceMock.recordEvent.mockResolvedValue({
      event: { id: 'evt1' },
      profile: { id: 'profile1' },
    });

    const result = await controller.recordEvent(
      '11111111-1111-1111-1111-111111111111',
      {
        kind: 'NEGATIVE_DISPUTE_OPENED' as any,
        scoreDelta: -15,
        reasonCode: 'DISPUTE_OPENED',
      },
    );

    expect(trustServiceMock.recordEvent).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      {
        kind: 'NEGATIVE_DISPUTE_OPENED',
        scoreDelta: -15,
        reasonCode: 'DISPUTE_OPENED',
      },
    );

    expect(result).toEqual({
      event: { id: 'evt1' },
      profile: { id: 'profile1' },
    });
  });

  it('delegates restriction release to the service', async () => {
    trustServiceMock.releaseRestriction.mockResolvedValue({
      restriction: { id: 'r1' },
      profile: { id: 'profile1' },
    });

    const result = await controller.releaseRestriction(
      '22222222-2222-2222-2222-222222222222',
      { notes: 'released' },
      { user: { userId: 'admin1' } },
    );

    expect(trustServiceMock.releaseRestriction).toHaveBeenCalledWith(
      '22222222-2222-2222-2222-222222222222',
      { notes: 'released' },
      'admin1',
    );

    expect(result).toEqual({
      restriction: { id: 'r1' },
      profile: { id: 'profile1' },
    });
  });
});