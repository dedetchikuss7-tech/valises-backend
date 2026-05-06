import { Test, TestingModule } from '@nestjs/testing';
import { AdminLedgerIntegrityController } from './admin-ledger-integrity.controller';
import { AdminLedgerIntegrityService } from './admin-ledger-integrity.service';
import { LedgerIntegrityStatus } from './dto/list-ledger-mismatches-query.dto';

describe('AdminLedgerIntegrityController', () => {
  let controller: AdminLedgerIntegrityController;

  const adminLedgerIntegrityServiceMock = {
    getTransactionIntegrity: jest.fn(),
    listMismatches: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminLedgerIntegrityController],
      providers: [
        {
          provide: AdminLedgerIntegrityService,
          useValue: adminLedgerIntegrityServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminLedgerIntegrityController>(
      AdminLedgerIntegrityController,
    );
  });

  it('delegates transaction integrity loading to the service', async () => {
    adminLedgerIntegrityServiceMock.getTransactionIntegrity.mockResolvedValue({
      transactionId: '11111111-1111-1111-1111-111111111111',
      integrityStatus: LedgerIntegrityStatus.OK,
    });

    const result = await controller.getTransactionIntegrity(
      '11111111-1111-1111-1111-111111111111',
    );

    expect(
      adminLedgerIntegrityServiceMock.getTransactionIntegrity,
    ).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111');
    expect(result.integrityStatus).toBe(LedgerIntegrityStatus.OK);
  });

  it('delegates mismatch listing query to the service', async () => {
    adminLedgerIntegrityServiceMock.listMismatches.mockResolvedValue({
      inspectedCount: 2,
      mismatchCount: 1,
      items: [
        {
          transactionId: 'tx1',
          integrityStatus: LedgerIntegrityStatus.BREACH,
        },
      ],
    });

    const query = {
      status: LedgerIntegrityStatus.BREACH,
      includeOk: false,
      limit: 20,
      offset: 0,
    };

    const result = await controller.listMismatches(query);

    expect(adminLedgerIntegrityServiceMock.listMismatches).toHaveBeenCalledWith(
      query,
    );
    expect(result.mismatchCount).toBe(1);
  });
});