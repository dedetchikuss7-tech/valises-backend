import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import {
  EvidenceAttachmentObjectType,
  EvidenceAttachmentStatus,
  EvidenceAttachmentType,
  EvidenceAttachmentVisibility,
  PackageStatus,
  Role,
} from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type SeedUser = {
  id: string;
  email: string;
  role: Role;
  token: string;
};

describe('Evidence lifecycle flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let sender: SeedUser;
  let traveler: SeedUser;
  let outsider: SeedUser;
  let admin: SeedUser;

  const jwtSecret = process.env.JWT_SECRET ?? 'dev_jwt_secret';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase();

    sender = await createUserWithToken(
      `sender-${Date.now()}@valises.test`,
      Role.USER,
    );
    traveler = await createUserWithToken(
      `traveler-${Date.now()}@valises.test`,
      Role.USER,
    );
    outsider = await createUserWithToken(
      `outsider-${Date.now()}@valises.test`,
      Role.USER,
    );
    admin = await createUserWithToken(
      `admin-${Date.now()}@valises.test`,
      Role.ADMIN,
    );
  });

  async function cleanDatabase() {
    await prisma.messageModerationEvent.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();

    await prisma.reminderJob.deleteMany();
    await prisma.abandonmentEvent.deleteMany();

    await prisma.evidenceAttachment.deleteMany();

    await prisma.payout.deleteMany();
    await prisma.refund.deleteMany();

    await prisma.ledgerEntry.deleteMany();

    await prisma.disputeResolution.deleteMany();
    await prisma.dispute.deleteMany();

    await prisma.transaction.deleteMany();
    await prisma.package.deleteMany();
    await prisma.trip.deleteMany();

    await prisma.corridorPricingPaymentConfig.deleteMany();
    await prisma.corridor.deleteMany();

    await prisma.adminActionAudit.deleteMany();
    await prisma.adminTimelineEvent.deleteMany();

    await prisma.user.deleteMany();
  }

  async function createUserWithToken(
    email: string,
    role: Role,
  ): Promise<SeedUser> {
    const passwordHash = await bcrypt.hash('Password123!', 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role,
        kycStatus: 'VERIFIED',
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    const token = jwt.sign(
      {
        sub: user.id,
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: '1h' },
    );

    return {
      ...user,
      token,
    };
  }

  async function createCorridor(code: string) {
    return prisma.corridor.create({
      data: {
        code,
        name: code,
        status: 'ACTIVE',
      },
    });
  }

  async function createPackage(params: {
    senderId: string;
    corridorId: string;
    weightKg?: number;
  }) {
    return prisma.package.create({
      data: {
        senderId: params.senderId,
        corridorId: params.corridorId,
        weightKg: params.weightKg ?? 10,
        description: 'Evidence lifecycle package',
        status: PackageStatus.PUBLISHED,
      },
    });
  }

  it('runs the complete evidence upload confirmation and admin review lifecycle', async () => {
    const corridor = await createCorridor('FR_CM');
    const pkg = await createPackage({
      senderId: sender.id,
      corridorId: corridor.id,
    });

    const uploadIntentRes = await request(app.getHttpServer())
      .post('/evidence/upload-intents')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: pkg.id,
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        fileName: 'package-front.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 12345,
      })
      .expect(201);

    expect(uploadIntentRes.body).toEqual(
      expect.objectContaining({
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: pkg.id,
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        fileName: 'package-front.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 12345,
        provider: 'MOCK_STORAGE',
        method: 'PUT',
        uploadStatus: 'PENDING_CLIENT_UPLOAD',
      }),
    );

    expect(uploadIntentRes.body.storageKey).toContain(
      `pending/evidence/package/${pkg.id}/package_photo/${sender.id}/`,
    );
    expect(uploadIntentRes.body.uploadUrl).toContain('mock-storage.local');
    expect(uploadIntentRes.body.objectUrl).toContain('mock-storage.local');
    expect(uploadIntentRes.body.allowedMimeTypes).toContain('image/jpeg');

    const confirmUploadRes = await request(app.getHttpServer())
      .post('/evidence/attachments/confirm-upload')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: pkg.id,
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        visibility: EvidenceAttachmentVisibility.ADMIN_ONLY,
        label: 'Package front photo',
        storageKey: uploadIntentRes.body.storageKey,
        fileName: 'package-front.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 12345,
        metadata: {
          source: 'e2e',
        },
      })
      .expect(201);

    expect(confirmUploadRes.body).toEqual(
      expect.objectContaining({
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: pkg.id,
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        status: EvidenceAttachmentStatus.PENDING_REVIEW,
        visibility: EvidenceAttachmentVisibility.ADMIN_ONLY,
        uploadedById: sender.id,
        label: 'Package front photo',
        provider: 'MOCK_STORAGE',
        fileName: 'package-front.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 12345,
      }),
    );

    expect(confirmUploadRes.body.storageKey).toContain(
      `uploaded/evidence/package/${pkg.id}/package_photo/${sender.id}/`,
    );
    expect(confirmUploadRes.body.providerUploadId).toContain('mock-upload:');
    expect(confirmUploadRes.body.objectUrl).toContain('mock-storage.local');
    expect(confirmUploadRes.body.fileUrl).toBe(confirmUploadRes.body.objectUrl);
    expect(confirmUploadRes.body.metadata).toEqual(
      expect.objectContaining({
        source: 'e2e',
        uploadConfirmation: expect.objectContaining({
          confirmed: true,
          uploadStatus: 'UPLOADED',
        }),
      }),
    );

    const evidenceId = confirmUploadRes.body.id;

    const adminQueueRes = await request(app.getHttpServer())
      .get('/evidence/admin/review-queue')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: pkg.id,
      })
      .expect(200);

    expect(adminQueueRes.body.total).toBe(1);
    expect(adminQueueRes.body.items).toHaveLength(1);
    expect(adminQueueRes.body.items[0]).toEqual(
      expect.objectContaining({
        id: evidenceId,
        status: EvidenceAttachmentStatus.PENDING_REVIEW,
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: pkg.id,
        provider: 'MOCK_STORAGE',
        storageCompletenessStatus: 'COMPLETE',
        recommendedAction: 'REVIEW_ATTACHMENT',
      }),
    );

    expect(adminQueueRes.body.items[0].reviewAgeMinutes).toEqual(
      expect.any(Number),
    );
    expect(adminQueueRes.body.items[0].isReviewOverdue).toEqual(
      expect.any(Boolean),
    );
    expect(adminQueueRes.body.items[0].reviewPriority).toEqual(
      expect.any(String),
    );
    expect(adminQueueRes.body.items[0].reviewReasons).toContain(
      'PENDING_REVIEW',
    );
    expect(adminQueueRes.body.items[0].reviewReasons).toContain(
      'STORAGE_COMPLETE',
    );

    const reviewRes = await request(app.getHttpServer())
      .patch(`/evidence/attachments/${evidenceId}/review`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        status: EvidenceAttachmentStatus.ACCEPTED,
        reviewNotes: 'Package photo is readable.',
      })
      .expect(200);

    expect(reviewRes.body).toEqual(
      expect.objectContaining({
        id: evidenceId,
        status: EvidenceAttachmentStatus.ACCEPTED,
        reviewedByAdminId: admin.id,
        reviewNotes: 'Package photo is readable.',
        rejectionReason: null,
        provider: 'MOCK_STORAGE',
      }),
    );

    const audit = await prisma.adminActionAudit.findFirst({
      where: {
        action: 'EVIDENCE_ACCEPTED',
        targetType: 'EVIDENCE_ATTACHMENT',
        targetId: evidenceId,
        actorUserId: admin.id,
      },
    });

    expect(audit).not.toBeNull();
    expect(audit?.metadata).toEqual(
      expect.objectContaining({
        evidenceId,
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: pkg.id,
        newStatus: EvidenceAttachmentStatus.ACCEPTED,
        storageKey: confirmUploadRes.body.storageKey,
      }),
    );

    const reviewedQueueRes = await request(app.getHttpServer())
      .get('/evidence/admin/review-queue')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({
        status: EvidenceAttachmentStatus.ACCEPTED,
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: pkg.id,
      })
      .expect(200);

    expect(reviewedQueueRes.body.total).toBe(1);
    expect(reviewedQueueRes.body.items[0]).toEqual(
      expect.objectContaining({
        id: evidenceId,
        status: EvidenceAttachmentStatus.ACCEPTED,
        recommendedAction: 'NO_ACTION_REQUIRED',
        storageCompletenessStatus: 'COMPLETE',
      }),
    );
    expect(reviewedQueueRes.body.items[0].reviewReasons).toContain(
      'ACCEPTED_ATTACHMENT',
    );
  });

  it('rejects evidence upload intent for a package owned by another user', async () => {
    const corridor = await createCorridor('FR_CI');
    const pkg = await createPackage({
      senderId: sender.id,
      corridorId: corridor.id,
    });

    await request(app.getHttpServer())
      .post('/evidence/upload-intents')
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: pkg.id,
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        fileName: 'package-front.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 12345,
      })
      .expect(403);
  });

  it('rejects evidence confirmation for a package owned by another user', async () => {
    const corridor = await createCorridor('FR_SN');
    const pkg = await createPackage({
      senderId: sender.id,
      corridorId: corridor.id,
    });

    await request(app.getHttpServer())
      .post('/evidence/attachments/confirm-upload')
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: pkg.id,
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        visibility: EvidenceAttachmentVisibility.ADMIN_ONLY,
        label: 'Package front photo',
        storageKey:
          'pending/evidence/package/pkg-1/package_photo/outsider-1/photo.jpg',
        fileName: 'package-front.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 12345,
      })
      .expect(403);

    const count = await prisma.evidenceAttachment.count({
      where: {
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: pkg.id,
      },
    });

    expect(count).toBe(0);
  });

  it('rejects evidence review by a non-admin user', async () => {
    const corridor = await createCorridor('CM_FR');
    const pkg = await createPackage({
      senderId: sender.id,
      corridorId: corridor.id,
    });

    const evidence = await prisma.evidenceAttachment.create({
      data: {
        targetType: EvidenceAttachmentObjectType.PACKAGE,
        targetId: pkg.id,
        attachmentType: EvidenceAttachmentType.PACKAGE_PHOTO,
        status: EvidenceAttachmentStatus.PENDING_REVIEW,
        visibility: EvidenceAttachmentVisibility.ADMIN_ONLY,
        uploadedById: sender.id,
        label: 'Package front photo',
        fileUrl: 'https://mock-storage.local/object/photo.jpg',
        provider: 'MOCK_STORAGE',
        providerUploadId: 'mock-upload:photo',
        storageKey: 'uploaded/evidence/package/pkg-1/package_photo/user-1/photo.jpg',
        objectUrl: 'https://mock-storage.local/object/photo.jpg',
        fileName: 'package-front.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 12345,
      },
    });

    await request(app.getHttpServer())
      .patch(`/evidence/attachments/${evidence.id}/review`)
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        status: EvidenceAttachmentStatus.ACCEPTED,
        reviewNotes: 'Trying to self-review',
      })
      .expect(403);

    const unchanged = await prisma.evidenceAttachment.findUniqueOrThrow({
      where: { id: evidence.id },
    });

    expect(unchanged.status).toBe(EvidenceAttachmentStatus.PENDING_REVIEW);
    expect(unchanged.reviewedByAdminId).toBeNull();
    expect(unchanged.reviewedAt).toBeNull();
  });
});