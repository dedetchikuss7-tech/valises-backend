import { Test, TestingModule } from '@nestjs/testing';
import { LegalController } from './legal.controller';
import { LegalService } from './legal.service';

describe('LegalController', () => {
  let controller: LegalController;

  const legalServiceMock = {
    recordAcceptance: jest.fn(),
    listMyAcceptances: jest.fn(),
    listAcceptances: jest.fn(),
    acknowledgeTransactionPlatformRole: jest.fn(),
    acknowledgeTransactionDeliveryRisk: jest.fn(),
    acknowledgePackageRules: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LegalController],
      providers: [{ provide: LegalService, useValue: legalServiceMock }],
    }).compile();

    controller = module.get<LegalController>(LegalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates recordMyAcceptance to the service', async () => {
    legalServiceMock.recordAcceptance.mockResolvedValue({
      id: 'legal1',
      userId: 'user1',
    });

    const dto = {
      documentType: 'TERMS_OF_SERVICE',
      documentVersion: 'v1',
      context: 'GLOBAL',
    } as any;

    const result = await controller.recordMyAcceptance(
      { user: { userId: 'user1' } },
      dto,
    );

    expect(legalServiceMock.recordAcceptance).toHaveBeenCalledWith('user1', dto);
    expect(result).toEqual({
      id: 'legal1',
      userId: 'user1',
    });
  });

  it('delegates listMyAcceptances to the service', async () => {
    legalServiceMock.listMyAcceptances.mockResolvedValue([{ id: 'legal1' }]);

    const result = await controller.listMyAcceptances({
      user: { userId: 'user1' },
    });

    expect(legalServiceMock.listMyAcceptances).toHaveBeenCalledWith('user1');
    expect(result).toEqual([{ id: 'legal1' }]);
  });

  it('delegates listAcceptances to the service', async () => {
    legalServiceMock.listAcceptances.mockResolvedValue([{ id: 'legal2' }]);

    const query = {
      context: 'TRANSACTION',
      limit: 10,
    } as any;

    const result = await controller.listAcceptances(query);

    expect(legalServiceMock.listAcceptances).toHaveBeenCalledWith(query);
    expect(result).toEqual([{ id: 'legal2' }]);
  });

  it('delegates acknowledgeTransactionPlatformRole to the service', async () => {
    legalServiceMock.acknowledgeTransactionPlatformRole.mockResolvedValue({
      id: 'legal3',
    });

    const result = await controller.acknowledgeTransactionPlatformRole(
      { user: { userId: 'user1', role: 'USER' } },
      '11111111-1111-1111-1111-111111111111',
    );

    expect(
      legalServiceMock.acknowledgeTransactionPlatformRole,
    ).toHaveBeenCalledWith(
      'user1',
      'USER',
      '11111111-1111-1111-1111-111111111111',
    );

    expect(result).toEqual({ id: 'legal3' });
  });

  it('delegates acknowledgeTransactionDeliveryRisk to the service', async () => {
    legalServiceMock.acknowledgeTransactionDeliveryRisk.mockResolvedValue({
      id: 'legal4',
    });

    const result = await controller.acknowledgeTransactionDeliveryRisk(
      { user: { userId: 'user1', role: 'USER' } },
      '22222222-2222-2222-2222-222222222222',
    );

    expect(
      legalServiceMock.acknowledgeTransactionDeliveryRisk,
    ).toHaveBeenCalledWith(
      'user1',
      'USER',
      '22222222-2222-2222-2222-222222222222',
    );

    expect(result).toEqual({ id: 'legal4' });
  });

  it('delegates acknowledgePackageRules to the service', async () => {
    legalServiceMock.acknowledgePackageRules.mockResolvedValue({
      id: 'legal5',
    });

    const result = await controller.acknowledgePackageRules(
      { user: { userId: 'user1', role: 'USER' } },
      '33333333-3333-3333-3333-333333333333',
    );

    expect(legalServiceMock.acknowledgePackageRules).toHaveBeenCalledWith(
      'user1',
      'USER',
      '33333333-3333-3333-3333-333333333333',
    );

    expect(result).toEqual({ id: 'legal5' });
  });
});