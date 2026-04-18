import { Test, TestingModule } from '@nestjs/testing';
import { AmlController } from './aml.controller';
import { AmlService } from './aml.service';

describe('AmlController', () => {
  let controller: AmlController;

  const amlServiceMock = {
    evaluateTransaction: jest.fn(),
    listCases: jest.fn(),
    getCase: jest.fn(),
    resolveCase: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AmlController],
      providers: [{ provide: AmlService, useValue: amlServiceMock }],
    }).compile();

    controller = module.get<AmlController>(AmlController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates transaction evaluation to the service', async () => {
    amlServiceMock.evaluateTransaction.mockResolvedValue({
      transactionId: 'tx1',
      allowed: false,
    });

    const result = await controller.evaluateTransaction(
      '11111111-1111-1111-1111-111111111111',
    );

    expect(amlServiceMock.evaluateTransaction).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
    );
    expect(result).toEqual({
      transactionId: 'tx1',
      allowed: false,
    });
  });

  it('delegates case resolution to the service', async () => {
    amlServiceMock.resolveCase.mockResolvedValue({
      id: 'aml1',
      currentAction: 'ALLOW',
    });

    const result = await controller.resolveCase(
      '22222222-2222-2222-2222-222222222222',
      { action: 'ALLOW', notes: 'approved' },
      { user: { userId: 'admin1' } },
    );

    expect(amlServiceMock.resolveCase).toHaveBeenCalledWith(
      '22222222-2222-2222-2222-222222222222',
      { action: 'ALLOW', notes: 'approved' },
      'admin1',
    );
    expect(result).toEqual({
      id: 'aml1',
      currentAction: 'ALLOW',
    });
  });
});