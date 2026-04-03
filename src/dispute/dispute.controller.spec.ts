import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';

describe('DisputeController', () => {
  let controller: DisputeController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    getRecommendation: jest.Mock;
    resolve: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      getRecommendation: jest.fn(),
      resolve: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisputeController],
      providers: [
        {
          provide: DisputeService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<DisputeController>(DisputeController);
  });

  it('should create dispute with openedById from JWT user', async () => {
    service.create.mockResolvedValue({ id: 'dp1' });

    const req = {
      user: {
        userId: 'user-123',
        role: Role.USER,
      },
    };

    const body = {
      transactionId: 'tx1',
      openedById: 'should-be-ignored',
      reason: 'Damaged item',
      reasonCode: 'DAMAGED',
    };

    const result = await controller.create(req, body as any);

    expect(result).toEqual({ id: 'dp1' });
    expect(service.create).toHaveBeenCalledWith({
      transactionId: 'tx1',
      openedById: 'user-123',
      actorRole: Role.USER,
      reason: 'Damaged item',
      reasonCode: 'DAMAGED',
    });
  });

  it('should throw UnauthorizedException when JWT userId is missing', async () => {
    const req = {
      user: {
        role: Role.USER,
      },
    };

    const body = {
      transactionId: 'tx1',
      reason: 'Damaged item',
      reasonCode: 'DAMAGED',
    };

    await expect(controller.create(req, body as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(service.create).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when JWT role is missing', async () => {
    const req = {
      user: {
        userId: 'user-123',
      },
    };

    const body = {
      transactionId: 'tx1',
      reason: 'Damaged item',
      reasonCode: 'DAMAGED',
    };

    await expect(controller.create(req, body as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(service.create).not.toHaveBeenCalled();
  });

  it('should list disputes for admin with query filters', async () => {
    service.findAll.mockResolvedValue([{ id: 'dp1' }]);

    const query = {
      status: 'OPEN',
      openingSource: 'MANUAL',
      initiatedBySide: 'SENDER',
      triggeredByRole: 'USER',
      transactionId: 'tx1',
    };

    const result = await controller.findAll(query as any);

    expect(result).toEqual([{ id: 'dp1' }]);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('should get one dispute', async () => {
    service.findOne.mockResolvedValue({ id: 'dp1' });

    const result = await controller.findOne('dp1');

    expect(result).toEqual({ id: 'dp1' });
    expect(service.findOne).toHaveBeenCalledWith('dp1');
  });

  it('should get dispute recommendation', async () => {
    service.getRecommendation.mockResolvedValue({
      disputeId: 'dp1',
      recommendedOutcome: 'REFUND_SENDER',
    });

    const query = { evidenceLevel: 'STRONG' };

    const result = await controller.recommendation('dp1', query as any);

    expect(result).toEqual({
      disputeId: 'dp1',
      recommendedOutcome: 'REFUND_SENDER',
    });
    expect(service.getRecommendation).toHaveBeenCalledWith('dp1', query);
  });

  it('should resolve dispute', async () => {
    service.resolve.mockResolvedValue({
      resolution: { id: 'dr1' },
      payout: null,
      refund: { id: 'rf1' },
    });

    const body = {
      decidedById: 'admin-1',
      outcome: 'REFUND_SENDER',
      evidenceLevel: 'STRONG',
    };

    const result = await controller.resolve('dp1', body as any);

    expect(result).toEqual({
      resolution: { id: 'dr1' },
      payout: null,
      refund: { id: 'rf1' },
    });
    expect(service.resolve).toHaveBeenCalledWith('dp1', body);
  });
});