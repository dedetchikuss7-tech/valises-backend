import { Test, TestingModule } from '@nestjs/testing';
import {
  AdminTimelineObjectType,
  AdminTimelineSeverity,
} from '@prisma/client';
import { AdminTimelineController } from './admin-timeline.controller';
import { AdminTimelineService } from './admin-timeline.service';

describe('AdminTimelineController', () => {
  let controller: AdminTimelineController;

  const adminTimelineServiceMock = {
    list: jest.fn(),
    listForObject: jest.fn(),
    getOne: jest.fn(),
    createManualEvent: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminTimelineController],
      providers: [
        {
          provide: AdminTimelineService,
          useValue: adminTimelineServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminTimelineController>(AdminTimelineController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates listing to the service', async () => {
    adminTimelineServiceMock.list.mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
      hasMore: false,
    });

    const query = {
      objectType: AdminTimelineObjectType.AML,
      limit: 20,
      offset: 0,
    };

    const result = await controller.list(query);

    expect(adminTimelineServiceMock.list).toHaveBeenCalledWith(query);
    expect(result.total).toBe(0);
  });

  it('delegates object timeline listing to the service', async () => {
    adminTimelineServiceMock.listForObject.mockResolvedValue({
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

    const result = await controller.listForObject(
      AdminTimelineObjectType.DISPUTE,
      'disp1',
      query,
    );

    expect(adminTimelineServiceMock.listForObject).toHaveBeenCalledWith(
      AdminTimelineObjectType.DISPUTE,
      'disp1',
      query,
    );
    expect(result.total).toBe(0);
  });

  it('delegates get one to the service', async () => {
    adminTimelineServiceMock.getOne.mockResolvedValue({
      id: 'evt1',
      objectType: AdminTimelineObjectType.PAYOUT,
      objectId: 'pay1',
    });

    const result = await controller.getOne('evt1');

    expect(adminTimelineServiceMock.getOne).toHaveBeenCalledWith('evt1');
    expect(result.id).toBe('evt1');
  });

  it('delegates manual event creation to the service', async () => {
    adminTimelineServiceMock.createManualEvent.mockResolvedValue({
      id: 'evt1',
      eventType: 'ADMIN_NOTE_ADDED',
    });

    const body = {
      objectType: AdminTimelineObjectType.AML,
      objectId: 'aml1',
      eventType: 'ADMIN_NOTE_ADDED',
      title: 'Admin note added',
      message: 'Manual note',
      severity: AdminTimelineSeverity.INFO,
      metadata: { note: 'Manual note' },
    };

    const result = await controller.createManualEvent(
      { user: { userId: 'admin1' } },
      body,
    );

    expect(adminTimelineServiceMock.createManualEvent).toHaveBeenCalledWith(
      'admin1',
      body,
    );
    expect(result.id).toBe('evt1');
  });
});