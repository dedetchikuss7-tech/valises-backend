import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RefundProvider } from '@prisma/client';
import { RefundController } from './refund.controller';
import { RefundService } from './refund.service';
import { RolesGuard } from '../auth/roles.guard';

describe('RefundController', () => {
  let controller: RefundController;
  let service: {
    list: jest.Mock;
    getByTransaction: jest.Mock;
    getOne: jest.Mock;
    retry: jest.Mock;
    markRefunded: jest.Mock;
    markFailed: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      list: jest.fn(),
      getByTransaction: jest.fn(),
      getOne: jest.fn(),
      retry: jest.fn(),
      markRefunded: jest.fn(),
      markFailed: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RefundController],
      providers: [{ provide: RefundService, useValue: service }],
    }).compile();

    controller = module.get<RefundController>(RefundController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list refunds', async () => {
    const query = {
      status: 'REQUESTED',
      provider: 'MANUAL',
      limit: 20,
    };

    service.list.mockResolvedValue([{ id: 'rf1' }]);

    const result = await controller.list(query as any);

    expect(result).toEqual([{ id: 'rf1' }]);
    expect(service.list).toHaveBeenCalledWith(query);
  });

  it('should get refund by transaction id', async () => {
    service.getByTransaction.mockResolvedValue({ id: 'rf1' });

    const result = await controller.getByTransaction('tx1');

    expect(result).toEqual({ id: 'rf1' });
    expect(service.getByTransaction).toHaveBeenCalledWith('tx1');
  });

  it('should get refund by id', async () => {
    service.getOne.mockResolvedValue({ id: 'rf1' });

    const result = await controller.getOne('rf1');

    expect(result).toEqual({ id: 'rf1' });
    expect(service.getOne).toHaveBeenCalledWith('rf1');
  });

  it('should retry refund with actorUserId from request', async () => {
    service.retry.mockResolvedValue({ id: 'rf1', status: 'REQUESTED' });

    const req = {
      user: {
        userId: 'admin1',
      },
    };

    const result = await controller.retry(
      'rf1',
      {
        provider: RefundProvider.MANUAL,
        reason: 'retry needed',
      },
      req,
    );

    expect(result).toEqual({ id: 'rf1', status: 'REQUESTED' });
    expect(service.retry).toHaveBeenCalledWith('rf1', {
      provider: RefundProvider.MANUAL,
      reason: 'retry needed',
      actorUserId: 'admin1',
    });
  });

  it('should mark refund refunded', async () => {
    service.markRefunded.mockResolvedValue({ id: 'rf1', status: 'REFUNDED' });

    const result = await controller.markRefunded(
      'rf1',
      {
        externalReference: 'ext-rf1',
        note: 'ok',
      },
      undefined,
    );

    expect(result).toEqual({ id: 'rf1', status: 'REFUNDED' });
    expect(service.markRefunded).toHaveBeenCalledWith('rf1', {
      externalReference: 'ext-rf1',
      note: 'ok',
      actorUserId: null,
    });
  });

  it('should mark refund failed', async () => {
    service.markFailed.mockResolvedValue({ id: 'rf1', status: 'FAILED' });

    const result = await controller.markFailed(
      'rf1',
      {
        reason: 'provider error',
      },
      undefined,
    );

    expect(result).toEqual({ id: 'rf1', status: 'FAILED' });
    expect(service.markFailed).toHaveBeenCalledWith('rf1', {
      reason: 'provider error',
    });
  });

  it('should mark refund failed with actorUserId from request', async () => {
    service.markFailed.mockResolvedValue({ id: 'rf1', status: 'FAILED' });

    const req = {
      user: {
        userId: 'admin1',
      },
    };

    const result = await controller.markFailed(
      'rf1',
      {
        reason: 'provider error',
      },
      req,
    );

    expect(result).toEqual({ id: 'rf1', status: 'FAILED' });
    expect(service.markFailed).toHaveBeenCalledWith('rf1', {
      reason: 'provider error',
      actorUserId: 'admin1',
    });
  });
});

describe('RolesGuard for RefundController admin routes', () => {
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

  it('should allow admin', () => {
    const ctx = makeContext({ userId: 'u1', role: 'ADMIN' }, ['ADMIN']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should reject user role', () => {
    const ctx = makeContext({ userId: 'u2', role: 'USER' }, ['ADMIN']);
    expect(() => guard.canActivate(ctx)).toThrow('Insufficient permissions');
  });

  it('should reject missing user', () => {
    const ctx = makeContext(undefined, ['ADMIN']);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});