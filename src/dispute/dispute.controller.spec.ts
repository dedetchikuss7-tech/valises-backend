import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';

describe('DisputeController', () => {
  let controller: DisputeController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    addCaseNote: jest.Mock;
    updateAdminDossier: jest.Mock;
    addEvidenceItem: jest.Mock;
    createEvidenceUploadIntent: jest.Mock;
    reviewEvidenceItem: jest.Mock;
    resetEvidenceItemReview: jest.Mock;
    invalidateEvidenceItem: jest.Mock;
    getRecommendation: jest.Mock;
    resolve: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      addCaseNote: jest.fn(),
      updateAdminDossier: jest.fn(),
      addEvidenceItem: jest.fn(),
      createEvidenceUploadIntent: jest.fn(),
      reviewEvidenceItem: jest.fn(),
      resetEvidenceItemReview: jest.fn(),
      invalidateEvidenceItem: jest.fn(),
      getRecommendation: jest.fn(),
      resolve: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisputeController],
      providers: [{ provide: DisputeService, useValue: service }],
    }).compile();

    controller = module.get<DisputeController>(DisputeController);
  });

  it('should create dispute with openedById from JWT user', async () => {
    service.create.mockResolvedValue({ id: 'dp1' });

    const req = { user: { userId: 'user-123', role: Role.USER } };
    const body = {
      transactionId: 'tx1',
      openedById: 'should-be-ignored',
      reason: 'Damaged item',
      reasonCode: 'DAMAGED',
    };

    const result = await controller.create(req, body as any);

    expect(result).toEqual({ id: 'dp1' });
    expect(service.create).toHaveBeenCalledWith({
      transactionId: 'tx1',
      openedById: 'user-123',
      actorRole: Role.USER,
      reason: 'Damaged item',
      reasonCode: 'DAMAGED',
    });
  });

  it('should add admin case note', async () => {
    service.addCaseNote.mockResolvedValue({ id: 'note-1' });

    const req = { user: { userId: 'admin-1', role: Role.ADMIN } };
    const body = { note: 'Called traveler. Awaiting supporting details.' };

    const result = await controller.addCaseNote('dp1', req, body as any);

    expect(result).toEqual({ id: 'note-1' });
    expect(service.addCaseNote).toHaveBeenCalledWith('dp1', 'admin-1', body);
  });

  it('should update admin dossier', async () => {
    service.updateAdminDossier.mockResolvedValue({ id: 'dp1' });

    const req = { user: { userId: 'admin-1', role: Role.ADMIN } };
    const body = {
      evidenceSummary: 'Photos received from sender.',
      adminAssessment: 'Damage plausible. Need traveler response.',
      evidenceStatus: 'IN_REVIEW',
    };

    const result = await controller.updateAdminDossier('dp1', req, body as any);

    expect(result).toEqual({ id: 'dp1' });
    expect(service.updateAdminDossier).toHaveBeenCalledWith(
      'dp1',
      'admin-1',
      body,
    );
  });

  it('should add dispute evidence item', async () => {
    service.addEvidenceItem.mockResolvedValue({ id: 'evi-1' });

    const req = { user: { userId: 'admin-1', role: Role.ADMIN } };
    const body = {
      kind: 'PHOTO',
      label: 'Sender photo 1',
      storageKey: 'disputes/dp1/photo1.jpg',
      fileName: 'photo1.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 120000,
    };

    const result = await controller.addEvidenceItem('dp1', req, body as any);

    expect(result).toEqual({ id: 'evi-1' });
    expect(service.addEvidenceItem).toHaveBeenCalledWith(
      'dp1',
      'admin-1',
      body,
    );
  });

  it('should create evidence upload intent', async () => {
    service.createEvidenceUploadIntent.mockResolvedValue({
      evidenceItem: { id: 'evi-upload-1' },
      uploadIntent: { storageKey: 'disputes/dp1/photo/123-photo1.jpg' },
    });

    const req = { user: { userId: 'admin-1', role: Role.ADMIN } };
    const body = {
      kind: 'PHOTO',
      label: 'Sender photo upload',
      fileName: 'photo1.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 120000,
    };

    const result = await controller.createEvidenceUploadIntent(
      'dp1',
      req,
      body as any,
    );

    expect(result).toEqual({
      evidenceItem: { id: 'evi-upload-1' },
      uploadIntent: { storageKey: 'disputes/dp1/photo/123-photo1.jpg' },
    });
    expect(service.createEvidenceUploadIntent).toHaveBeenCalledWith(
      'dp1',
      'admin-1',
      body,
    );
  });

  it('should review dispute evidence item', async () => {
    service.reviewEvidenceItem.mockResolvedValue({ id: 'evi-1' });

    const req = { user: { userId: 'admin-1', role: Role.ADMIN } };
    const body = {
      status: 'ACCEPTED',
    };

    const result = await controller.reviewEvidenceItem(
      'dp1',
      'evi-1',
      req,
      body as any,
    );

    expect(result).toEqual({ id: 'evi-1' });
    expect(service.reviewEvidenceItem).toHaveBeenCalledWith(
      'dp1',
      'evi-1',
      'admin-1',
      body,
    );
  });

  it('should reset dispute evidence item review', async () => {
    service.resetEvidenceItemReview.mockResolvedValue({ id: 'evi-1' });

    const req = { user: { userId: 'admin-1', role: Role.ADMIN } };
    const body = {
      reason: 'Need fresh review after additional context',
    };

    const result = await controller.resetEvidenceItemReview(
      'dp1',
      'evi-1',
      req,
      body as any,
    );

    expect(result).toEqual({ id: 'evi-1' });
    expect(service.resetEvidenceItemReview).toHaveBeenCalledWith(
      'dp1',
      'evi-1',
      'admin-1',
      body,
    );
  });

  it('should invalidate dispute evidence item', async () => {
    service.invalidateEvidenceItem.mockResolvedValue({ id: 'evi-1' });

    const req = { user: { userId: 'admin-1', role: Role.ADMIN } };
    const body = {
      reason: 'Duplicate or unusable evidence',
    };

    const result = await controller.invalidateEvidenceItem(
      'dp1',
      'evi-1',
      req,
      body as any,
    );

    expect(result).toEqual({ id: 'evi-1' });
    expect(service.invalidateEvidenceItem).toHaveBeenCalledWith(
      'dp1',
      'evi-1',
      'admin-1',
      body,
    );
  });

  it('should throw UnauthorizedException when JWT userId is missing', async () => {
    const req = { user: { role: Role.USER } };
    const body = {
      transactionId: 'tx1',
      reason: 'Damaged item',
      reasonCode: 'DAMAGED',
    };

    await expect(controller.create(req, body as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(service.create).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when JWT role is missing', async () => {
    const req = { user: { userId: 'user-123' } };
    const body = {
      transactionId: 'tx1',
      reason: 'Damaged item',
      reasonCode: 'DAMAGED',
    };

    await expect(controller.create(req, body as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(service.create).not.toHaveBeenCalled();
  });

  it('should list disputes for admin with query filters', async () => {
    service.findAll.mockResolvedValue([{ id: 'dp1' }]);

    const query = {
      status: 'OPEN',
      openingSource: 'MANUAL',
      initiatedBySide: 'SENDER',
      triggeredByRole: 'USER',
      transactionId: 'tx1',
    };

    const result = await controller.findAll(query as any);

    expect(result).toEqual([{ id: 'dp1' }]);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('should get one dispute', async () => {
    service.findOne.mockResolvedValue({ id: 'dp1' });

    const result = await controller.findOne('dp1');

    expect(result).toEqual({ id: 'dp1' });
    expect(service.findOne).toHaveBeenCalledWith('dp1');
  });

  it('should get dispute recommendation', async () => {
    service.getRecommendation.mockResolvedValue({
      disputeId: 'dp1',
      recommendedOutcome: 'REFUND_SENDER',
    });

    const query = { evidenceLevel: 'STRONG' };

    const result = await controller.recommendation('dp1', query as any);

    expect(result).toEqual({
      disputeId: 'dp1',
      recommendedOutcome: 'REFUND_SENDER',
    });
    expect(service.getRecommendation).toHaveBeenCalledWith('dp1', query);
  });

  it('should resolve dispute', async () => {
    service.resolve.mockResolvedValue({
      resolution: { id: 'dr1' },
      payout: null,
      refund: { id: 'rf1' },
    });

    const body = {
      decidedById: 'admin-1',
      outcome: 'REFUND_SENDER',
      evidenceLevel: 'STRONG',
    };

    const result = await controller.resolve('dp1', body as any);

    expect(result).toEqual({
      resolution: { id: 'dr1' },
      payout: null,
      refund: { id: 'rf1' },
    });
    expect(service.resolve).toHaveBeenCalledWith('dp1', body);
  });
});