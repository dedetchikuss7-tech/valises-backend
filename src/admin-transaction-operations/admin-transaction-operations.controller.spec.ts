import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminOwnershipOperationalStatus } from '@prisma/client';
import { AdminTransactionOperationsController } from './admin-transaction-operations.controller';
import { AdminTransactionOperationsService } from './admin-transaction-operations.service';
import { AdminTransactionOperationalPriority } from './dto/update-admin-transaction-operational-case.dto';
import { AdminTransactionOperationalResolutionCategory } from './dto/resolve-admin-transaction-operational-case.dto';

describe('AdminTransactionOperationsController', () => {
  let controller: AdminTransactionOperationsController;

  const serviceMock = {
    listQueue: jest.fn(),
    getSummary: jest.fn(),
    getTransactionDetail: jest.fn(),
    getOperationalCase: jest.fn(),
    updateOperationalCase: jest.fn(),
    resolveOperationalCase: jest.fn(),
    reopenOperationalCase: jest.fn(),
  };

  const req = {
    user: {
      userId: 'admin1',
      role: 'ADMIN',
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminTransactionOperationsController],
      providers: [
        {
          provide: AdminTransactionOperationsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminTransactionOperationsController>(
      AdminTransactionOperationsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates queue listing to service', async () => {
    serviceMock.listQueue.mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
      hasMore: false,
    });

    const query = { limit: 20, offset: 0 };

    const result = await controller.listQueue(query as any);

    expect(serviceMock.listQueue).toHaveBeenCalledWith(query);
    expect(result.total).toBe(0);
  });

  it('delegates summary loading to service', async () => {
    serviceMock.getSummary.mockResolvedValue({
      generatedAt: new Date('2099-01-01T00:00:00.000Z'),
      totalRows: 0,
    });

    const result = await controller.getSummary();

    expect(serviceMock.getSummary).toHaveBeenCalledWith();
    expect(result.totalRows).toBe(0);
  });

  it('delegates transaction drilldown loading to service', async () => {
    serviceMock.getTransactionDetail.mockResolvedValue({
      lifecycle: {
        transactionId: '11111111-1111-1111-1111-111111111111',
      },
    });

    const result = await controller.getTransactionDetail(
      '11111111-1111-1111-1111-111111111111',
    );

    expect(serviceMock.getTransactionDetail).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
    );
    expect(result.lifecycle.transactionId).toBe(
      '11111111-1111-1111-1111-111111111111',
    );
  });

  it('delegates operational case loading to service', async () => {
    serviceMock.getOperationalCase.mockResolvedValue({
      transactionId: '11111111-1111-1111-1111-111111111111',
      assignedAdminId: 'admin1',
    });

    const result = await controller.getOperationalCase(
      '11111111-1111-1111-1111-111111111111',
      req,
    );

    expect(serviceMock.getOperationalCase).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'admin1',
    );
    expect(result.assignedAdminId).toBe('admin1');
  });

  it('delegates operational case update to service', async () => {
    const dto = {
      operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
      priority: AdminTransactionOperationalPriority.HIGH,
      note: 'Review started',
    };

    serviceMock.updateOperationalCase.mockResolvedValue({
      transactionId: '11111111-1111-1111-1111-111111111111',
      operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
    });

    const result = await controller.updateOperationalCase(
      '11111111-1111-1111-1111-111111111111',
      dto,
      req,
    );

    expect(serviceMock.updateOperationalCase).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'admin1',
      dto,
    );
    expect(result.operationalStatus).toBe(
      AdminOwnershipOperationalStatus.IN_REVIEW,
    );
  });

  it('delegates operational case resolution to service', async () => {
    const dto = {
      resolutionCategory:
        AdminTransactionOperationalResolutionCategory.DELIVERY_VALIDATED,
      resolutionSummary: 'Delivery proof reviewed and accepted.',
      resolutionCode: 'DELIVERY_PROOF_VALIDATED',
    };

    serviceMock.resolveOperationalCase.mockResolvedValue({
      transactionId: '11111111-1111-1111-1111-111111111111',
      operationalResolutionSummary: dto.resolutionSummary,
    });

    const result = await controller.resolveOperationalCase(
      '11111111-1111-1111-1111-111111111111',
      dto,
      req,
    );

    expect(serviceMock.resolveOperationalCase).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'admin1',
      dto,
    );
    expect(result.operationalResolutionSummary).toBe(dto.resolutionSummary);
  });

  it('delegates operational case reopening to service', async () => {
    const dto = {
      reason: 'New evidence received.',
      reopenCode: 'NEW_EVIDENCE_RECEIVED',
    };

    serviceMock.reopenOperationalCase.mockResolvedValue({
      transactionId: '11111111-1111-1111-1111-111111111111',
      operationalReopenReason: dto.reason,
    });

    const result = await controller.reopenOperationalCase(
      '11111111-1111-1111-1111-111111111111',
      dto,
      req,
    );

    expect(serviceMock.reopenOperationalCase).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'admin1',
      dto,
    );
    expect(result.operationalReopenReason).toBe(dto.reason);
  });

  it('throws UnauthorizedException when user id is missing on protected case action', async () => {
    await expect(
      controller.getOperationalCase(
        '11111111-1111-1111-1111-111111111111',
        { user: { role: 'ADMIN' } },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});