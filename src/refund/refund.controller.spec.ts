import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RefundController } from './refund.controller';
import { RefundService } from './refund.service';
import { RolesGuard } from '../auth/roles.guard';

describe('RefundController', () => {
  let controller: RefundController;
  let service: {
    getByTransaction: jest.Mock;
    markRefunded: jest.Mock;
    markFailed: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getByTransaction: jest.fn(),
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

  it('should get refund by transaction id', async () => {
    service.getByTransaction.mockResolvedValue({ id: 'rf1' });

    const result = await controller.getByTransaction('tx1');

    expect(result).toEqual({ id: 'rf1' });
    expect(service.getByTransaction).toHaveBeenCalledWith('tx1');
  });

  it('should mark refund refunded', async () => {
    service.markRefunded.mockResolvedValue({ id: 'rf1', status: 'REFUNDED' });

    const result = await controller.markRefunded('rf1', {
      externalReference: 'ext-rf1',
      note: 'ok',
    });

    expect(result).toEqual({ id: 'rf1', status: 'REFUNDED' });
    expect(service.markRefunded).toHaveBeenCalledWith('rf1', {
      externalReference: 'ext-rf1',
      note: 'ok',
      actorUserId: null,
    });
  });

  it('should mark refund failed', async () => {
    service.markFailed.mockResolvedValue({ id: 'rf1', status: 'FAILED' });

    const result = await controller.markFailed('rf1', {
      reason: 'provider error',
    });

    expect(result).toEqual({ id: 'rf1', status: 'FAILED' });
    expect(service.markFailed).toHaveBeenCalledWith('rf1', {
      reason: 'provider error',
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