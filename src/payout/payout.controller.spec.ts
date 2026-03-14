import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PayoutProvider } from '@prisma/client';
import { PayoutController } from './payout.controller';
import { PayoutService } from './payout.service';
import { RolesGuard } from '../auth/roles.guard';

describe('PayoutController', () => {
  let controller: PayoutController;
  let service: {
    getByTransaction: jest.Mock;
    getOne: jest.Mock;
    requestPayoutForTransaction: jest.Mock;
    markPaid: jest.Mock;
    markFailed: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getByTransaction: jest.fn(),
      getOne: jest.fn(),
      requestPayoutForTransaction: jest.fn(),
      markPaid: jest.fn(),
      markFailed: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PayoutController],
      providers: [
        { provide: PayoutService, useValue: service },
      ],
    }).compile();

    controller = module.get<PayoutController>(PayoutController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get payout by transaction id', async () => {
    service.getByTransaction.mockResolvedValue({ id: 'po1' });

    const result = await controller.getByTransaction('tx1');

    expect(result).toEqual({ id: 'po1' });
    expect(service.getByTransaction).toHaveBeenCalledWith('tx1');
  });

  it('should get payout by id', async () => {
    service.getOne.mockResolvedValue({ id: 'po1' });

    const result = await controller.getOne('po1');

    expect(result).toEqual({ id: 'po1' });
    expect(service.getOne).toHaveBeenCalledWith('po1');
  });

  it('should request payout', async () => {
    service.requestPayoutForTransaction.mockResolvedValue({ id: 'po1' });

    const result = await controller.requestPayout('tx1', {
      provider: PayoutProvider.MANUAL,
    });

    expect(result).toEqual({ id: 'po1' });
    expect(service.requestPayoutForTransaction).toHaveBeenCalledWith(
      'tx1',
      PayoutProvider.MANUAL,
    );
  });

  it('should mark payout paid', async () => {
    service.markPaid.mockResolvedValue({ id: 'po1', status: 'PAID' });

    const result = await controller.markPaid('po1', {
      externalReference: 'ext-1',
      note: 'done',
    });

    expect(result).toEqual({ id: 'po1', status: 'PAID' });
    expect(service.markPaid).toHaveBeenCalledWith('po1', {
      externalReference: 'ext-1',
      note: 'done',
      actorUserId: null,
    });
  });

  it('should mark payout failed', async () => {
    service.markFailed.mockResolvedValue({ id: 'po1', status: 'FAILED' });

    const result = await controller.markFailed('po1', {
      reason: 'provider error',
    });

    expect(result).toEqual({ id: 'po1', status: 'FAILED' });
    expect(service.markFailed).toHaveBeenCalledWith('po1', {
      reason: 'provider error',
    });
  });
});

describe('RolesGuard for PayoutController admin routes', () => {
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