import { Test, TestingModule } from '@nestjs/testing';
import {
  AdminOwnershipObjectType,
  AdminOwnershipOperationalStatus,
} from '@prisma/client';
import { AdminOwnershipController } from './admin-ownership.controller';
import { AdminOwnershipService } from './admin-ownership.service';

describe('AdminOwnershipController', () => {
  let controller: AdminOwnershipController;

  const adminOwnershipServiceMock = {
    getSummary: jest.fn(),
    list: jest.fn(),
    getOne: jest.fn(),
    claim: jest.fn(),
    release: jest.fn(),
    updateStatus: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOwnershipController],
      providers: [
        {
          provide: AdminOwnershipService,
          useValue: adminOwnershipServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminOwnershipController>(AdminOwnershipController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates summary loading to the service', async () => {
    adminOwnershipServiceMock.getSummary.mockResolvedValue({
      generatedAt: new Date('2099-01-01T00:00:00.000Z'),
      totalRows: 1,
      unassignedRows: 0,
      claimedRows: 1,
      inReviewRows: 0,
      waitingExternalRows: 0,
      doneRows: 0,
      releasedRows: 0,
      overdueRows: 0,
      dueSoonRows: 0,
    });

    const result = await controller.getSummary();

    expect(adminOwnershipServiceMock.getSummary).toHaveBeenCalled();
    expect(result.totalRows).toBe(1);
  });

  it('delegates listing to the service', async () => {
    adminOwnershipServiceMock.list.mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
      hasMore: false,
    });

    const query = {
      objectType: AdminOwnershipObjectType.AML,
      onlyOverdue: true,
      limit: 20,
      offset: 0,
    };

    const result = await controller.list(query);

    expect(adminOwnershipServiceMock.list).toHaveBeenCalledWith(query);
    expect(result.total).toBe(0);
  });

  it('delegates get one to the service', async () => {
    adminOwnershipServiceMock.getOne.mockResolvedValue({
      id: 'own1',
      objectType: AdminOwnershipObjectType.AML,
      objectId: 'aml1',
    });

    const result = await controller.getOne(AdminOwnershipObjectType.AML, 'aml1');

    expect(adminOwnershipServiceMock.getOne).toHaveBeenCalledWith(
      AdminOwnershipObjectType.AML,
      'aml1',
    );
    expect(result.id).toBe('own1');
  });

  it('delegates claim to the service', async () => {
    adminOwnershipServiceMock.claim.mockResolvedValue({
      id: 'own1',
      assignedAdminId: 'admin1',
      operationalStatus: AdminOwnershipOperationalStatus.CLAIMED,
    });

    const body = {
      objectType: AdminOwnershipObjectType.AML,
      objectId: 'aml1',
      note: 'take it',
    };

    const result = await controller.claim({ user: { userId: 'admin1' } }, body);

    expect(adminOwnershipServiceMock.claim).toHaveBeenCalledWith(
      'admin1',
      body,
    );
    expect(result.assignedAdminId).toBe('admin1');
  });

  it('delegates release to the service', async () => {
    adminOwnershipServiceMock.release.mockResolvedValue({
      id: 'own1',
      assignedAdminId: null,
      operationalStatus: AdminOwnershipOperationalStatus.RELEASED,
    });

    const body = {
      objectType: AdminOwnershipObjectType.PAYOUT,
      objectId: 'pay1',
      note: 'release it',
    };

    const result = await controller.release(
      { user: { userId: 'admin1' } },
      body,
    );

    expect(adminOwnershipServiceMock.release).toHaveBeenCalledWith(
      'admin1',
      body,
    );
    expect(result.assignedAdminId).toBeNull();
  });

  it('delegates status update to the service', async () => {
    adminOwnershipServiceMock.updateStatus.mockResolvedValue({
      id: 'own1',
      operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
    });

    const body = {
      objectType: AdminOwnershipObjectType.FINANCIAL_CONTROL,
      objectId: 'tx1',
      operationalStatus: AdminOwnershipOperationalStatus.IN_REVIEW,
      note: 'reviewing',
    };

    const result = await controller.updateStatus(
      { user: { userId: 'admin1' } },
      body,
    );

    expect(adminOwnershipServiceMock.updateStatus).toHaveBeenCalledWith(
      'admin1',
      body,
    );
    expect(result.operationalStatus).toBe(
      AdminOwnershipOperationalStatus.IN_REVIEW,
    );
  });
});