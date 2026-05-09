import { Test, TestingModule } from '@nestjs/testing';
import { AdminTransactionOperationsController } from './admin-transaction-operations.controller';
import { AdminTransactionOperationsService } from './admin-transaction-operations.service';

describe('AdminTransactionOperationsController', () => {
  let controller: AdminTransactionOperationsController;

  const serviceMock = {
    listQueue: jest.fn(),
    getSummary: jest.fn(),
    getTransactionDetail: jest.fn(),
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

  it('delegates queue listing to service', async () => {
    serviceMock.listQueue.mockResolvedValue({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
      hasMore: false,
    });

    const query = {
      requiresAdminAttention: true,
      limit: 50,
      offset: 0,
    };

    const result = await controller.listQueue(query as any);

    expect(serviceMock.listQueue).toHaveBeenCalledWith(query);
    expect(result.total).toBe(0);
  });

  it('delegates summary loading to service', async () => {
    serviceMock.getSummary.mockResolvedValue({
      totalRows: 2,
      highSeverityCount: 1,
    });

    const result = await controller.getSummary();

    expect(serviceMock.getSummary).toHaveBeenCalled();
    expect(result.totalRows).toBe(2);
  });

  it('delegates transaction detail loading to service', async () => {
    serviceMock.getTransactionDetail.mockResolvedValue({
      lifecycle: {
        transactionId: '11111111-1111-1111-1111-111111111111',
      },
      evidence: [],
      disputes: [],
      restrictions: [],
      nextOperationalSteps: ['No immediate admin action required.'],
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
});