import { Test, TestingModule } from '@nestjs/testing';
import { AdminOpsController } from './admin-ops.controller';
import { AdminOpsService } from './admin-ops.service';
import { AdminOpsCaseType } from './dto/list-admin-ops-cases-query.dto';

describe('AdminOpsController', () => {
  let controller: AdminOpsController;

  const adminOpsServiceMock = {
    getDashboard: jest.fn(),
    listCases: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOpsController],
      providers: [
        {
          provide: AdminOpsService,
          useValue: adminOpsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminOpsController>(AdminOpsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates dashboard loading to the service', async () => {
    adminOpsServiceMock.getDashboard.mockResolvedValue({
      generatedAt: new Date('2099-01-01T00:00:00.000Z'),
      openAmlCases: 2,
      openDisputes: 3,
      activeRestrictions: 4,
      pendingPayouts: 1,
      pendingRefunds: 1,
      activeAbandonmentEvents: 5,
      pendingReminderJobs: 6,
      visibleShortlistEntries: 7,
      requiresActionCount: 22,
    });

    const result = await controller.getDashboard();

    expect(adminOpsServiceMock.getDashboard).toHaveBeenCalled();
    expect(result.openAmlCases).toBe(2);
  });

  it('delegates unified case listing to the service', async () => {
    adminOpsServiceMock.listCases.mockResolvedValue([
      {
        caseType: AdminOpsCaseType.AML,
        caseId: 'aml1',
      },
    ]);

    const query = {
      caseType: AdminOpsCaseType.AML,
      requiresAction: true,
      limit: 10,
    };

    const result = await controller.listCases(query);

    expect(adminOpsServiceMock.listCases).toHaveBeenCalledWith(query);
    expect(result).toEqual([
      {
        caseType: AdminOpsCaseType.AML,
        caseId: 'aml1',
      },
    ]);
  });
});