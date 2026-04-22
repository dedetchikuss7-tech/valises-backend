import { Test, TestingModule } from '@nestjs/testing';
import { AdminFinancialControlsController } from './admin-financial-controls.controller';
import { AdminFinancialControlsService } from './admin-financial-controls.service';
import { AdminFinancialControlStatus } from './dto/list-admin-financial-controls-query.dto';

describe('AdminFinancialControlsController', () => {
  let controller: AdminFinancialControlsController;

  const adminFinancialControlsServiceMock = {
    getSummary: jest.fn(),
    listControls: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminFinancialControlsController],
      providers: [
        {
          provide: AdminFinancialControlsService,
          useValue: adminFinancialControlsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminFinancialControlsController>(
      AdminFinancialControlsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates summary loading to the service', async () => {
    adminFinancialControlsServiceMock.getSummary.mockResolvedValue({
      generatedAt: new Date('2099-01-01T00:00:00.000Z'),
      totalRows: 3,
      cleanRows: 1,
      warningRows: 1,
      breachRows: 1,
      requiresActionCount: 2,
    });

    const result = await controller.getSummary();

    expect(adminFinancialControlsServiceMock.getSummary).toHaveBeenCalled();
    expect(result.totalRows).toBe(3);
  });

  it('delegates control listing to the service', async () => {
    adminFinancialControlsServiceMock.listControls.mockResolvedValue({
      items: [
        {
          transactionId: 'tx1',
          derivedStatus: AdminFinancialControlStatus.WARNING,
        },
      ],
      total: 1,
      limit: 10,
      offset: 0,
      hasMore: false,
    });

    const query = {
      status: AdminFinancialControlStatus.WARNING,
      q: 'ledger',
      requiresAction: true,
      limit: 10,
      offset: 0,
    };

    const result = await controller.listCases(query);

    expect(adminFinancialControlsServiceMock.listControls).toHaveBeenCalledWith(
      query,
    );
    expect(result.items).toEqual([
      {
        transactionId: 'tx1',
        derivedStatus: AdminFinancialControlStatus.WARNING,
      },
    ]);
    expect(result.total).toBe(1);
  });
});