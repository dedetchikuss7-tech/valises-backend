import { Test, TestingModule } from '@nestjs/testing';
import { PackageController } from './package.controller';
import { PackageService } from './package.service';

describe('PackageController', () => {
  let controller: PackageController;

  const packageServiceMock = {
    createDraft: jest.fn(),
    findMine: jest.fn(),
    publish: jest.fn(),
    cancel: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PackageController],
      providers: [{ provide: PackageService, useValue: packageServiceMock }],
    }).compile();

    controller = module.get<PackageController>(PackageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});