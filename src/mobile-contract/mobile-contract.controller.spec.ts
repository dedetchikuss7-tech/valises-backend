import { Test, TestingModule } from '@nestjs/testing';
import { MobileContractController } from './mobile-contract.controller';
import { MobileContractService } from './mobile-contract.service';

describe('MobileContractController', () => {
  let controller: MobileContractController;

  const mobileContractServiceMock = {
    getMyContract: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MobileContractController],
      providers: [
        {
          provide: MobileContractService,
          useValue: mobileContractServiceMock,
        },
      ],
    }).compile();

    controller = module.get<MobileContractController>(MobileContractController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates getMyContract to the service', async () => {
    mobileContractServiceMock.getMyContract.mockResolvedValue({
      contractVersion: 'v1',
      user: { id: 'user1' },
    });

    const result = await controller.getMyContract({
      user: { userId: 'user1' },
    });

    expect(mobileContractServiceMock.getMyContract).toHaveBeenCalledWith(
      'user1',
    );
    expect(result).toEqual({
      contractVersion: 'v1',
      user: { id: 'user1' },
    });
  });
});