import { Test, TestingModule } from '@nestjs/testing';
import { AdminFinancialOperationsController } from './admin-financial-operations.controller';
import { AdminFinancialOperationsService } from './admin-financial-operations.service';
import {
  AdminFinancialOperationObjectType,
  AdminFinancialOperationPriority,
} from './dto/list-admin-financial-operations-query.dto';

describe('AdminFinancialOperationsController', () => {
  let controller: AdminFinancialOperationsController;

  const adminFinancialOperationsServiceMock = {
    getSummary: jest.fn(),
    listOperations: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminFinancialOperationsController],
      providers: [
        {
          provide: AdminFinancialOperationsService,
          useValue: adminFinancialOperationsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminFinancialOperationsController>(
      AdminFinancialOperationsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates summary loading to the service', async () => {
    adminFinancialOperationsServiceMock.getSummary.mockResolvedValue({
      generatedAt: new Date('2099-01-01T00:00:00.000Z'),
      totalItems: 3,
      highPriorityCount: 1,
      mediumPriorityCount: 1,
      lowPriorityCount: 1,
      requiresActionCount: 2,
      payoutItems: 1,
      refundItems: 1,
      financialControlItems: 1,
    });

    const result = await controller.getSummary();

    expect(adminFinancialOperationsServiceMock.getSummary).toHaveBeenCalled();
    expect(result.totalItems).toBe(3);
  });

  it('delegates queue listing to the service', async () => {
    adminFinancialOperationsServiceMock.listOperations.mockResolvedValue({
      items: [
        {
          objectType: AdminFinancialOperationObjectType.PAYOUT,
          objectId: 'payout1',
          transactionId: 'tx1',
          priority: AdminFinancialOperationPriority.HIGH,
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
      hasMore: false,
    });

    const query = {
      objectType: AdminFinancialOperationObjectType.PAYOUT,
      priority: AdminFinancialOperationPriority.HIGH,
      requiresAction: true,
      limit: 50,
      offset: 0,
    };

    const result = await controller.listQueue(query);

    expect(adminFinancialOperationsServiceMock.listOperations).toHaveBeenCalledWith(
      query,
    );
    expect(result.items).toHaveLength(1);
  });
});