import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DisputeReasonCode, EvidenceLevel } from '@prisma/client';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';
import { RolesGuard } from '../auth/roles.guard';

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
      providers: [{ provide: DisputeService, useValue: service }],
    }).compile();

    controller = module.get<DisputeController>(DisputeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create dispute with openedById from JWT user', async () => {
    service.create.mockResolvedValue({ id: 'dp1' });

    const req = { user: { userId: 'user-123', role: 'USER' } };

    const result = await controller.create(req, {
      transactionId: 'tx1',
      reason: 'Damaged item',
      reasonCode: DisputeReasonCode.DAMAGED,
    } as any);

    expect(result).toEqual({ id: 'dp1' });
    expect(service.create).toHaveBeenCalledWith({
      transactionId: 'tx1',
      openedById: 'user-123',
      reason: 'Damaged item',
      reasonCode: DisputeReasonCode.DAMAGED,
    });
  });

  it('should reject create if JWT user missing', async () => {
    const req = { user: undefined };

    await expect(
      controller.create(req, {
        transactionId: 'tx1',
        reason: 'Damaged item',
        reasonCode: DisputeReasonCode.DAMAGED,
      } as any),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should list disputes', async () => {
    service.findAll.mockResolvedValue([{ id: 'dp1' }]);

    const result = await controller.findAll();

    expect(result).toEqual([{ id: 'dp1' }]);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('should get one dispute', async () => {
    service.findOne.mockResolvedValue({ id: 'dp1' });

    const result = await controller.findOne('dp1');

    expect(result).toEqual({ id: 'dp1' });
    expect(service.findOne).toHaveBeenCalledWith('dp1');
  });

  it('should get recommendation', async () => {
    service.getRecommendation.mockResolvedValue({
      disputeId: 'dp1',
      recommendedOutcome: 'SPLIT',
    });

    const result = await controller.recommendation('dp1', {
      evidenceLevel: EvidenceLevel.STRONG,
    });

    expect(result).toEqual({
      disputeId: 'dp1',
      recommendedOutcome: 'SPLIT',
    });
    expect(service.getRecommendation).toHaveBeenCalledWith('dp1', {
      evidenceLevel: EvidenceLevel.STRONG,
    });
  });

  it('should resolve dispute', async () => {
    service.resolve.mockResolvedValue({
      resolution: { id: 'dr1' },
      payout: null,
      refund: null,
    });

    const body = {
      decidedById: 'admin1',
      outcome: 'SPLIT',
      refundAmount: 100,
      releaseAmount: 200,
    };

    const result = await controller.resolve('dp1', body as any);

    expect(result).toEqual({
      resolution: { id: 'dr1' },
      payout: null,
      refund: null,
    });
    expect(service.resolve).toHaveBeenCalledWith('dp1', body);
  });
});

describe('RolesGuard for DisputeController admin routes', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function makeContext(user: any, requiredRoles: string[]): ExecutionContext {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(requiredRoles as any);

    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as ExecutionContext;
  }

  it('should allow admin on protected dispute routes', () => {
    const ctx = makeContext({ userId: 'admin1', role: 'ADMIN' }, ['ADMIN']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should reject non-admin on protected dispute routes', () => {
    const ctx = makeContext({ userId: 'user1', role: 'USER' }, ['ADMIN']);
    expect(() => guard.canActivate(ctx)).toThrow('Insufficient permissions');
  });

  it('should reject missing user on protected dispute routes', () => {
    const ctx = makeContext(undefined, ['ADMIN']);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should allow authenticated create route when no role metadata is required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { userId: 'user1', role: 'USER' } }),
      }),
    } as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(true);
  });
});