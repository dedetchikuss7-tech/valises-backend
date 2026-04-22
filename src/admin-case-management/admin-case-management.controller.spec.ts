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
    expect(result.items).toEqual([
      {
        sourceType: AdminCaseSourceType.AML,
        sourceId: 'aml1',
        status: AdminCaseDerivedStatus.OPEN,
      },
    ]);
    expect(result.total).toBe(1);
  });

  it('delegates transverse case opening to the service', async () => {
    adminCaseManagementServiceMock.openFromSource.mockResolvedValue({
      sourceType: AdminCaseSourceType.DISPUTE,
      sourceId: 'disp1',
    });

    const result = await controller.openFromSource(
      { user: { userId: 'admin1' } },
      {
        sourceType: AdminCaseSourceType.DISPUTE,
        sourceId: 'disp1',
        note: 'Open this case',
      },
    );

    expect(adminCaseManagementServiceMock.openFromSource).toHaveBeenCalledWith(
      {
        sourceType: AdminCaseSourceType.DISPUTE,
        sourceId: 'disp1',
        note: 'Open this case',
      },
      'admin1',
    );

    expect(result).toEqual({
      sourceType: AdminCaseSourceType.DISPUTE,
      sourceId: 'disp1',
    });
  });

  it('delegates case take to the service', async () => {
    adminCaseManagementServiceMock.takeCase.mockResolvedValue({
      sourceType: AdminCaseSourceType.AML,
      sourceId: 'aml1',
      status: AdminCaseDerivedStatus.IN_PROGRESS,
    });

    const result = await controller.takeCase(
      { user: { userId: 'admin1' } },
      AdminCaseSourceType.AML,
      'aml1',
      { note: 'I take this one' },
    );

    expect(adminCaseManagementServiceMock.takeCase).toHaveBeenCalledWith(
      AdminCaseSourceType.AML,
      'aml1',
      'admin1',
      { note: 'I take this one' },
    );

    expect(result.status).toBe(AdminCaseDerivedStatus.IN_PROGRESS);
  });

  it('delegates note creation to the service', async () => {
    adminCaseManagementServiceMock.addNote.mockResolvedValue({
      sourceType: AdminCaseSourceType.PAYOUT,
      sourceId: 'pay1',
    });

    const result = await controller.addNote(
      { user: { userId: 'admin1' } },
      AdminCaseSourceType.PAYOUT,
      'pay1',
      { note: 'Follow up with provider' },
    );

    expect(adminCaseManagementServiceMock.addNote).toHaveBeenCalledWith(
      AdminCaseSourceType.PAYOUT,
      'pay1',
      'admin1',
      { note: 'Follow up with provider' },
    );

    expect(result).toEqual({
      sourceType: AdminCaseSourceType.PAYOUT,
      sourceId: 'pay1',
    });
  });
});