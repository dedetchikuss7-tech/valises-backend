import { Test, TestingModule } from '@nestjs/testing';
import { AdminCaseManagementController } from './admin-case-management.controller';
import { AdminCaseManagementService } from './admin-case-management.service';
import {
  AdminCaseDerivedStatus,
  AdminCaseSourceType,
} from './dto/list-admin-case-management-query.dto';

describe('AdminCaseManagementController', () => {
  let controller: AdminCaseManagementController;

  const adminCaseManagementServiceMock = {
    listCases: jest.fn(),
    getCase: jest.fn(),
    openFromSource: jest.fn(),
    takeCase: jest.fn(),
    releaseCase: jest.fn(),
    resolveCase: jest.fn(),
    addNote: jest.fn(),
    bulkTakeCases: jest.fn(),
    bulkReleaseCases: jest.fn(),
    bulkResolveCases: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminCaseManagementController],
      providers: [
        {
          provide: AdminCaseManagementService,
          useValue: adminCaseManagementServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminCaseManagementController>(
      AdminCaseManagementController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates transverse case listing to the service', async () => {
    adminCaseManagementServiceMock.listCases.mockResolvedValue({
      items: [
        {
          sourceType: AdminCaseSourceType.AML,
          sourceId: 'aml1',
          status: AdminCaseDerivedStatus.OPEN,
        },
      ],
      total: 1,
      limit: 10,
      offset: 0,
      hasMore: false,
    });

    const query = {
      sourceType: AdminCaseSourceType.AML,
      requiresAction: true,
      q: 'aml',
      limit: 10,
      offset: 0,
    };

    const result = await controller.listCases(query);

    expect(adminCaseManagementServiceMock.listCases).toHaveBeenCalledWith(query);
    expect(result.items).toHaveLength(1);
  });

  it('delegates bulk take to the service', async () => {
    adminCaseManagementServiceMock.bulkTakeCases.mockResolvedValue({
      requestedCount: 2,
      successCount: 2,
      failureCount: 0,
      results: [],
    });

    const dto = {
      items: [
        { sourceType: AdminCaseSourceType.AML, sourceId: 'aml1' },
        { sourceType: AdminCaseSourceType.DISPUTE, sourceId: 'disp1' },
      ],
      note: 'take all',
    };

    const result = await controller.bulkTake(
      { user: { userId: 'admin1' } },
      dto,
    );

    expect(adminCaseManagementServiceMock.bulkTakeCases).toHaveBeenCalledWith(
      'admin1',
      dto,
    );
    expect(result.successCount).toBe(2);
  });

  it('delegates bulk release to the service', async () => {
    adminCaseManagementServiceMock.bulkReleaseCases.mockResolvedValue({
      requestedCount: 1,
      successCount: 1,
      failureCount: 0,
      results: [],
    });

    const dto = {
      items: [{ sourceType: AdminCaseSourceType.AML, sourceId: 'aml1' }],
      note: 'release',
    };

    const result = await controller.bulkRelease(
      { user: { userId: 'admin1' } },
      dto,
    );

    expect(adminCaseManagementServiceMock.bulkReleaseCases).toHaveBeenCalledWith(
      'admin1',
      dto,
    );
    expect(result.successCount).toBe(1);
  });

  it('delegates bulk resolve to the service', async () => {
    adminCaseManagementServiceMock.bulkResolveCases.mockResolvedValue({
      requestedCount: 1,
      successCount: 1,
      failureCount: 0,
      results: [],
    });

    const dto = {
      items: [{ sourceType: AdminCaseSourceType.AML, sourceId: 'aml1' }],
      note: 'resolve',
    };

    const result = await controller.bulkResolve(
      { user: { userId: 'admin1' } },
      dto,
    );

    expect(adminCaseManagementServiceMock.bulkResolveCases).toHaveBeenCalledWith(
      'admin1',
      dto,
    );
    expect(result.successCount).toBe(1);
  });
});