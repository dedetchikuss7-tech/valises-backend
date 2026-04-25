import { Test, TestingModule } from '@nestjs/testing';
import { AdminWorkloadController } from './admin-workload.controller';
import { AdminWorkloadService } from './admin-workload.service';
import { AdminWorkloadQueuePreset } from './dto/list-admin-workload-queue-query.dto';

describe('AdminWorkloadController', () => {
  let controller: AdminWorkloadController;

  const adminWorkloadServiceMock = {
    getSummary: jest.fn(),
    listQueue: jest.fn(),
    listAssignees: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminWorkloadController],
      providers: [
        {
          provide: AdminWorkloadService,
          useValue: adminWorkloadServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminWorkloadController>(AdminWorkloadController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates summary loading to the service with acting admin id', async () => {
    adminWorkloadServiceMock.getSummary.mockResolvedValue({
      generatedAt: new Date('2099-01-01T00:00:00.000Z'),
      totalRows: 1,
      openRows: 1,
      unassignedRows: 0,
      myOpenRows: 1,
      overdueRows: 0,
      dueSoonRows: 0,
      claimedRows: 1,
      inReviewRows: 0,
      waitingExternalRows: 0,
      doneRows: 0,
      releasedRows: 0,
    });

    const result = await controller.getSummary({
      user: { userId: 'admin1' },
    });

    expect(adminWorkloadServiceMock.getSummary).toHaveBeenCalledWith('admin1');
    expect(result.myOpenRows).toBe(1);
  });

  it('delegates queue listing to the service with acting admin id', async () => {
    adminWorkloadServiceMock.listQueue.mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
      hasMore: false,
    });

    const query = {
      limit: 20,
      offset: 0,
    };

    const result = await controller.listQueue(
      { user: { userId: 'admin1' } },
      AdminWorkloadQueuePreset.MY_QUEUE,
      query,
    );

    expect(adminWorkloadServiceMock.listQueue).toHaveBeenCalledWith(
      'admin1',
      AdminWorkloadQueuePreset.MY_QUEUE,
      query,
    );
    expect(result.total).toBe(0);
  });

  it('delegates assignee distribution loading to the service', async () => {
    adminWorkloadServiceMock.listAssignees.mockResolvedValue({
      generatedAt: new Date('2099-01-01T00:00:00.000Z'),
      items: [],
    });

    const result = await controller.listAssignees();

    expect(adminWorkloadServiceMock.listAssignees).toHaveBeenCalled();
    expect(result.items).toEqual([]);
  });
});