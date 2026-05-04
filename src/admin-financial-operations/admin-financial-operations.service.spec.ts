import { PayoutStatus, RefundStatus } from '@prisma/client';
import { AdminFinancialControlsService } from '../admin-financial-controls/admin-financial-controls.service';
import { AdminFinancialControlStatus } from '../admin-financial-controls/dto/list-admin-financial-controls-query.dto';
import { AdminFinancialOperationsService } from './admin-financial-operations.service';
import {
  AdminFinancialOperationObjectType,
  AdminFinancialOperationPriority,
  AdminFinancialOperationRecommendedAction,
} from './dto/list-admin-financial-operations-query.dto';

describe('AdminFinancialOperationsService', () => {
  let service: AdminFinancialOperationsService;

  const prismaMock = {
    payout: {
      findMany: jest.fn(),
    },
    refund: {
      findMany: jest.fn(),
    },
  };

  const financialControlsServiceMock = {
    listControls: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new AdminFinancialOperationsService(
      prismaMock as any,
      financialControlsServiceMock as unknown as AdminFinancialControlsService,
    );
  });

  it('builds a unified financial operations queue with payout, refund and control rows', async () => {
    prismaMock.payout.findMany.mockResolvedValue([
      {
        id: 'payout1',
        transactionId: 'tx1',
        status: PayoutStatus.FAILED,
        amount: 1000,
        currency: 'XAF',
        provider: 'MANUAL',
        railProvider: 'MANUAL',
        payoutMethodType: 'MANUAL_PAYOUT',
        externalReference: null,
        failureReason: 'Provider failed',
        metadata: null,
        requestedAt: new Date('2099-01-01T00:00:00.000Z'),
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        updatedAt: new Date('2099-01-01T01:00:00.000Z'),
        transaction: {
          id: 'tx1',
          status: 'DELIVERED',
          paymentStatus: 'SUCCESS',
          escrowAmount: 1000,
          senderId: 'sender1',
          travelerId: 'traveler1',
          currency: 'XAF',
        },
      },
    ]);

    prismaMock.refund.findMany.mockResolvedValue([
      {
        id: 'refund1',
        transactionId: 'tx2',
        status: RefundStatus.REQUESTED,
        amount: 500,
        currency: 'XAF',
        provider: 'MANUAL',
        externalReference: null,
        failureReason: null,
        metadata: null,
        requestedAt: new Date('2099-01-02T00:00:00.000Z'),
        createdAt: new Date('2099-01-02T00:00:00.000Z'),
        updatedAt: new Date('2099-01-02T01:00:00.000Z'),
        transaction: {
          id: 'tx2',
          status: 'CANCELLED',
          paymentStatus: 'SUCCESS',
          escrowAmount: 500,
          senderId: 'sender2',
          travelerId: 'traveler2',
          currency: 'XAF',
        },
      },
    ]);

    financialControlsServiceMock.listControls.mockResolvedValue({
      items: [
        {
          transactionId: 'tx3',
          derivedStatus: AdminFinancialControlStatus.BREACH,
          requiresAction: true,
          createdAt: new Date('2099-01-03T00:00:00.000Z'),
          updatedAt: new Date('2099-01-03T01:00:00.000Z'),
          senderId: 'sender3',
          travelerId: 'traveler3',
          transactionStatus: 'PAID',
          paymentStatus: 'SUCCESS',
          transactionAmount: 2000,
          currency: 'XAF',
          ledgerCreditedAmount: 2000,
          ledgerReleasedAmount: 0,
          ledgerRefundedAmount: 0,
          payoutPaidAmount: 0,
          refundPaidAmount: 0,
          remainingEscrowAmount: 2000,
          mismatchSignals: ['ESCROW_NOT_RELEASED'],
          metadata: null,
          lastAdminActionAt: null,
          lastAdminActionBy: null,
          lastAdminActionType: null,
          adminActionCount: 0,
        },
      ],
      total: 1,
      limit: 100,
      offset: 0,
      hasMore: false,
    });

    const result = await service.listOperations({
      limit: 50,
      offset: 0,
    });

    expect(result.total).toBe(3);
    expect(result.items[0].priority).toBe(
      AdminFinancialOperationPriority.HIGH,
    );

    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectType: AdminFinancialOperationObjectType.PAYOUT,
          objectId: 'payout1',
          recommendedAction:
            AdminFinancialOperationRecommendedAction.RETRY_PAYOUT,
        }),
        expect.objectContaining({
          objectType: AdminFinancialOperationObjectType.REFUND,
          objectId: 'refund1',
          recommendedAction:
            AdminFinancialOperationRecommendedAction.PROCESS_REFUND,
        }),
        expect.objectContaining({
          objectType: AdminFinancialOperationObjectType.FINANCIAL_CONTROL,
          objectId: 'tx3',
          recommendedAction:
            AdminFinancialOperationRecommendedAction.REVIEW_FINANCIAL_CONTROL,
        }),
      ]),
    );
  });

  it('filters queue by objectType and requiresAction', async () => {
    prismaMock.payout.findMany.mockResolvedValue([
      {
        id: 'payout1',
        transactionId: 'tx1',
        status: PayoutStatus.PAID,
        amount: 1000,
        currency: 'XAF',
        provider: 'MANUAL',
        railProvider: null,
        payoutMethodType: null,
        externalReference: null,
        failureReason: null,
        metadata: null,
        requestedAt: null,
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        updatedAt: new Date('2099-01-01T01:00:00.000Z'),
        transaction: {
          id: 'tx1',
          status: 'DELIVERED',
          paymentStatus: 'SUCCESS',
          escrowAmount: 0,
          senderId: 'sender1',
          travelerId: 'traveler1',
          currency: 'XAF',
        },
      },
    ]);

    prismaMock.refund.findMany.mockResolvedValue([]);
    financialControlsServiceMock.listControls.mockResolvedValue({
      items: [],
      total: 0,
      limit: 100,
      offset: 0,
      hasMore: false,
    });

    const result = await service.listOperations({
      objectType: AdminFinancialOperationObjectType.PAYOUT,
      requiresAction: false,
      limit: 50,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].objectType).toBe(
      AdminFinancialOperationObjectType.PAYOUT,
    );
    expect(result.items[0].requiresAction).toBe(false);
  });

  it('returns summary counts', async () => {
    prismaMock.payout.findMany.mockResolvedValue([
      {
        id: 'payout1',
        transactionId: 'tx1',
        status: PayoutStatus.FAILED,
        amount: 1000,
        currency: 'XAF',
        provider: 'MANUAL',
        railProvider: null,
        payoutMethodType: null,
        externalReference: null,
        failureReason: 'failed',
        metadata: null,
        requestedAt: null,
        createdAt: new Date('2099-01-01T00:00:00.000Z'),
        updatedAt: new Date('2099-01-01T01:00:00.000Z'),
        transaction: {
          id: 'tx1',
          status: 'DELIVERED',
          paymentStatus: 'SUCCESS',
          escrowAmount: 1000,
          senderId: 'sender1',
          travelerId: 'traveler1',
          currency: 'XAF',
        },
      },
    ]);

    prismaMock.refund.findMany.mockResolvedValue([]);
    financialControlsServiceMock.listControls.mockResolvedValue({
      items: [],
      total: 0,
      limit: 100,
      offset: 0,
      hasMore: false,
    });

    const result = await service.getSummary();

    expect(result.totalItems).toBe(1);
    expect(result.highPriorityCount).toBe(1);
    expect(result.requiresActionCount).toBe(1);
    expect(result.payoutItems).toBe(1);
  });
});