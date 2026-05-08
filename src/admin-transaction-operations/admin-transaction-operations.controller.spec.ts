import { Test, TestingModule } from '@nestjs/testing';
import { AdminTransactionOperationsController } from './admin-transaction-operations.controller';
import { AdminTransactionOperationsService } from './admin-transaction-operations.service';

describe('AdminTransactionOperationsController', () => {
  let controller: AdminTransactionOperationsController;

  const serviceMock = {
    listQueue: jest.fn(),
    getSummary: jest.fn(),
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
      items: [{ transactionId: 'tx1' }],
      total: 1,
      limit: 20,
      offset: 0,
      hasMore: false,
    });

    const query = { limit: 20, offset: 0 } as any;

    const result = await controller.listQueue(query);

    expect(serviceMock.listQueue).toHaveBeenCalledWith(query);
    expect(result.total).toBe(1);
  });

  it('delegates summary loading to service', async () => {
    serviceMock.getSummary.mockResolvedValue({
      totalRows: 1,
      highSeverityCount: 1,
    });

    const result = await controller.getSummary();

    expect(serviceMock.getSummary).toHaveBeenCalled();
    expect(result.totalRows).toBe(1);
  });
});