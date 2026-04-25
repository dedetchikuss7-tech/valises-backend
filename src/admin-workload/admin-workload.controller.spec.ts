import { Test, TestingModule } from '@nestjs/testing';
import {
  AdminOwnershipObjectType,
  AdminOwnershipOperationalStatus,
} from '@prisma/client';
import { AdminWorkloadController } from './admin-workload.controller';
import { AdminWorkloadService } from './admin-workload.service';
import { AdminWorkloadQueuePreset } from './dto/list-admin-workload-queue-query.dto';

describe('AdminWorkloadController', () => {
  let controller: AdminWorkloadController;

  const adminWorkloadServiceMock = {
    getSummary: jest.fn(),
    listQueue: jest.fn(),
    listAssignees: jest.fn(),
    claim: jest.fn(),
    release: jest.fn(),
    updateStatus: jest.fn(),
    bulkClaim: jest.fn(),
    bulkRelease: jest.fn(),
    bulkUpdateStatus: jest.fn(),
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

  it('delegates claim action to the service', async () => {
    adminWorkloadServiceMock.claim.mockResolvedValue({
      objectId: 'aml1',
      assignedAdminId: 'admin1',
    });

    const body = {
      objectType: AdminOwnershipObjectType.AML,
      objectId: 'aml1',
      note: 'claim',
    };

    const result = await controller.claim(
      { user: { userId: 'admin1' } },
      body,
    );

    expect(adminWorkloadServiceMock.claim).toHaveBeenCalledWith(
      'admin1',
      body,
    );
    expect(result.assignedAdminId).toBe('admin1');
  });

  it('delegates release action to the service', async () => {
    adminWorkloadServiceMock.release.mockResolvedValue({
      objectId: 'aml1',
      assignedAdminId: null,
    });

    const body = {
      objectType: AdminOwnershipObjectType.AML,
      objectId: 'aml1',
      note: 'release',
    };

    const result = await controller.release(
      { user: { userId: 'admin1' } },
      body,
    );

    expect(adminWorkloadServiceMock.release).toHaveBeenCalledWith(
      'admin1',
      body,
    );
    expect(result.assignedAdminId).toBeNull();
  });

  it('delegates status update action to the service', async () => {
    adminWorkloadServiceMock.updateStatus.mockResolvedValue({
      objectId: 'aml1',
      operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
    });

    const body = {
      objectType: AdminOwnershipObjectType.AML,
      objectId: 'aml1',
      operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
      note: 'review',
    };

    const result = await controller.updateStatus(
      { user: { userId: 'admin1' } },
      body,
    );

    expect(adminWorkloadServiceMock.updateStatus).toHaveBeenCalledWith(
      'admin1',
      body,
    );
    expect(result.operationalStatus).toBe(
      AdminOwnershipOperationalStatus.IN_REVIEW,
    );
  });

  it('delegates bulk claim action to the service', async () => {
    adminWorkloadServiceMock.bulkClaim.mockResolvedValue({
      requestedCount: 1,
      successCount: 1,
      failureCount: 0,
      results: [],
    });

    const body = {
      items: [
        {
          objectType: AdminOwnershipObjectType.AML,
          objectId: 'aml1',
        },
      ],
      note: 'bulk claim',
    };

    const result = await controller.bulkClaim(
      { user: { userId: 'admin1' } },
      body,
    );

    expect(adminWorkloadServiceMock.bulkClaim).toHaveBeenCalledWith(
      'admin1',
      body,
    );
    expect(result.successCount).toBe(1);
  });

  it('delegates bulk release action to the service', async () => {
    adminWorkloadServiceMock.bulkRelease.mockResolvedValue({
      requestedCount: 1,
      successCount: 1,
      failureCount: 0,
      results: [],
    });

    const body = {
      items: [
        {
          objectType: AdminOwnershipObjectType.AML,
          objectId: 'aml1',
        },
      ],
      note: 'bulk release',
    };

    const result = await controller.bulkRelease(
      { user: { userId: 'admin1' } },
      body,
    );

    expect(adminWorkloadServiceMock.bulkRelease).toHaveBeenCalledWith(
      'admin1',
      body,
    );
    expect(result.successCount).toBe(1);
  });

  it('delegates bulk status update action to the service', async () => {
    adminWorkloadServiceMock.bulkUpdateStatus.mockResolvedValue({
      requestedCount: 1,
      successCount: 1,
      failureCount: 0,
      results: [],
    });

    const body = {
      items: [
        {
          objectType: AdminOwnershipObjectType.AML,
          objectId: 'aml1',
        },
      ],
      operationalStatus: AdminOwnershipOperationalStatus.WAITING_EXTERNAL,
      note: 'bulk status',
    };

    const result = await controller.bulkUpdateStatus(
      { user: { userId: 'admin1' } },
      body,
    );

    expect(adminWorkloadServiceMock.bulkUpdateStatus).toHaveBeenCalledWith(
      'admin1',
      body,
    );
    expect(result.successCount).toBe(1);
  });
});