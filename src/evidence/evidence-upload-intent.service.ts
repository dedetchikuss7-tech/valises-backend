import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EvidenceAttachmentObjectType,
  Role,
  TransactionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from '../storage/storage.provider';
import { CreateEvidenceUploadIntentDto } from './dto/create-evidence-upload-intent.dto';
import { EvidenceUploadIntentResponseDto } from './dto/evidence-upload-intent-response.dto';

const EVIDENCE_MAX_SIZE_BYTES = 10 * 1024 * 1024;

const EVIDENCE_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'text/plain',
];

@Injectable()
export class EvidenceUploadIntentService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
  ) {}

  async createUploadIntent(
    actorUserId: string,
    actorRole: Role,
    dto: CreateEvidenceUploadIntentDto,
  ): Promise<EvidenceUploadIntentResponseDto> {
    const normalizedFileName = this.normalizeRequired(dto.fileName, 'fileName');
    const normalizedMimeType = this.normalizeRequired(
      dto.mimeType,
      'mimeType',
    ).toLowerCase();

    this.assertFileConstraints({
      fileName: normalizedFileName,
      mimeType: normalizedMimeType,
      sizeBytes: dto.sizeBytes,
    });

    await this.assertCanAccessTarget({
      actorUserId,
      actorRole,
      targetType: dto.targetType,
      targetId: dto.targetId,
    });

    const storageKey = this.buildStorageKey({
      targetType: dto.targetType,
      targetId: dto.targetId,
      attachmentType: dto.attachmentType,
      actorUserId,
      fileName: normalizedFileName,
    });

    const upload = await this.storageProvider.prepareUpload({
      storageKey,
      fileName: normalizedFileName,
      mimeType: normalizedMimeType,
      sizeBytes: dto.sizeBytes,
      kind: `EVIDENCE_${dto.attachmentType}`,
    });

    return {
      targetType: dto.targetType,
      targetId: dto.targetId,
      attachmentType: dto.attachmentType,
      fileName: normalizedFileName,
      mimeType: normalizedMimeType,
      sizeBytes: dto.sizeBytes,
      provider: upload.provider,
      storageKey: upload.storageKey,
      uploadUrl: upload.uploadUrl,
      method: upload.method,
      headers: upload.headers,
      expiresInSeconds: upload.expiresInSeconds,
      uploadStatus: upload.uploadStatus,
      providerUploadId: upload.providerUploadId,
      objectUrl: upload.objectUrl,
      publicUrl: upload.publicUrl,
      maxAllowedSizeBytes: upload.maxAllowedSizeBytes,
      allowedMimeTypes: EVIDENCE_ALLOWED_MIME_TYPES,
      nextStep:
        'Upload the file to uploadUrl using the returned method and headers, then create or confirm the EvidenceAttachment using the returned storageKey/objectUrl.',
    };
  }

  private assertFileConstraints(input: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }): void {
    if (!EVIDENCE_ALLOWED_MIME_TYPES.includes(input.mimeType)) {
      throw new BadRequestException(
        `Unsupported mimeType. Allowed values: ${EVIDENCE_ALLOWED_MIME_TYPES.join(
          ', ',
        )}`,
      );
    }

    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
      throw new BadRequestException('sizeBytes must be a positive integer');
    }

    if (input.sizeBytes > EVIDENCE_MAX_SIZE_BYTES) {
      throw new BadRequestException(
        `Evidence file is too large. Max size is ${EVIDENCE_MAX_SIZE_BYTES} bytes`,
      );
    }
  }

  private buildStorageKey(input: {
    targetType: EvidenceAttachmentObjectType;
    targetId: string;
    attachmentType: string;
    actorUserId: string;
    fileName: string;
  }): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    return [
      'pending',
      'evidence',
      this.safeSegment(input.targetType),
      this.safeSegment(input.targetId),
      this.safeSegment(input.attachmentType),
      this.safeSegment(input.actorUserId),
      `${timestamp}-${this.safeFileName(input.fileName)}`,
    ].join('/');
  }

  private safeSegment(value: string): string {
    const safe = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);

    return safe || 'unknown';
  }

  private safeFileName(value: string): string {
    const normalized = String(value ?? '')
      .trim()
      .replace(/\\/g, '/')
      .split('/')
      .pop();

    const safe = String(normalized ?? 'file')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180);

    return safe || 'file';
  }

  private normalizeRequired(value: string, fieldName: string): string {
    const normalized = String(value ?? '').trim();

    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    return normalized;
  }

  private async assertCanAccessTarget(input: {
    actorUserId: string;
    actorRole: Role;
    targetType: EvidenceAttachmentObjectType;
    targetId: string;
  }): Promise<void> {
    if (!input.targetId?.trim()) {
      throw new BadRequestException('targetId is required');
    }

    if (input.actorRole === Role.ADMIN) {
      await this.assertTargetExists(input.targetType, input.targetId);
      return;
    }

    switch (input.targetType) {
      case EvidenceAttachmentObjectType.PACKAGE:
        await this.assertCanAccessPackageTarget(
          input.actorUserId,
          input.targetId,
        );
        return;

      case EvidenceAttachmentObjectType.TRANSACTION:
      case EvidenceAttachmentObjectType.DELIVERY:
        await this.assertCanAccessTransactionTarget(
          input.actorUserId,
          input.targetId,
        );
        return;

      case EvidenceAttachmentObjectType.DISPUTE:
        await this.assertCanAccessDisputeTarget(
          input.actorUserId,
          input.targetId,
        );
        return;

      case EvidenceAttachmentObjectType.PAYOUT:
        await this.assertCanAccessPayoutTarget(
          input.actorUserId,
          input.targetId,
        );
        return;

      case EvidenceAttachmentObjectType.REFUND:
        await this.assertCanAccessRefundTarget(
          input.actorUserId,
          input.targetId,
        );
        return;

      case EvidenceAttachmentObjectType.KYC:
        await this.assertCanAccessKycTarget(input.actorUserId, input.targetId);
        return;

      case EvidenceAttachmentObjectType.ADMIN_CASE:
      case EvidenceAttachmentObjectType.OTHER:
      default:
        throw new ForbiddenException(
          'Only an admin can create upload intents for this target type',
        );
    }
  }

  private async assertTargetExists(
    targetType: EvidenceAttachmentObjectType,
    targetId: string,
  ): Promise<void> {
    switch (targetType) {
      case EvidenceAttachmentObjectType.PACKAGE: {
        const item = await this.prisma.package.findUnique({
          where: { id: targetId },
          select: { id: true },
        });

        if (!item) throw new NotFoundException('Target package not found');
        return;
      }

      case EvidenceAttachmentObjectType.TRANSACTION:
      case EvidenceAttachmentObjectType.DELIVERY: {
        const item = await this.prisma.transaction.findUnique({
          where: { id: targetId },
          select: { id: true },
        });

        if (!item) throw new NotFoundException('Target transaction not found');
        return;
      }

      case EvidenceAttachmentObjectType.DISPUTE: {
        const item = await this.prisma.dispute.findUnique({
          where: { id: targetId },
          select: { id: true },
        });

        if (!item) throw new NotFoundException('Target dispute not found');
        return;
      }

      case EvidenceAttachmentObjectType.PAYOUT: {
        const item = await this.prisma.payout.findUnique({
          where: { id: targetId },
          select: { id: true },
        });

        if (!item) throw new NotFoundException('Target payout not found');
        return;
      }

      case EvidenceAttachmentObjectType.REFUND: {
        const item = await this.prisma.refund.findUnique({
          where: { id: targetId },
          select: { id: true },
        });

        if (!item) throw new NotFoundException('Target refund not found');
        return;
      }

      case EvidenceAttachmentObjectType.KYC: {
        const item = await this.prisma.kycVerification.findUnique({
          where: { id: targetId },
          select: { id: true },
        });

        if (!item) {
          throw new NotFoundException('Target KYC verification not found');
        }
        return;
      }

      case EvidenceAttachmentObjectType.ADMIN_CASE:
      case EvidenceAttachmentObjectType.OTHER:
      default:
        return;
    }
  }

  private async assertCanAccessPackageTarget(
    actorUserId: string,
    packageId: string,
  ): Promise<void> {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        senderId: true,
      },
    });

    if (!pkg) throw new NotFoundException('Target package not found');

    if (pkg.senderId === actorUserId) return;

    const transaction = await this.prisma.transaction.findFirst({
      where: {
        packageId,
        NOT: { status: TransactionStatus.CANCELLED },
      },
      select: {
        senderId: true,
        travelerId: true,
      },
    });

    if (
      transaction?.senderId === actorUserId ||
      transaction?.travelerId === actorUserId
    ) {
      return;
    }

    throw new ForbiddenException(
      'You cannot create an upload intent for this package',
    );
  }

  private async assertCanAccessTransactionTarget(
    actorUserId: string,
    transactionId: string,
  ): Promise<void> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        senderId: true,
        travelerId: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Target transaction not found');
    }

    if (
      transaction.senderId === actorUserId ||
      transaction.travelerId === actorUserId
    ) {
      return;
    }

    throw new ForbiddenException(
      'You cannot create an upload intent for this transaction',
    );
  }

  private async assertCanAccessDisputeTarget(
    actorUserId: string,
    disputeId: string,
  ): Promise<void> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      select: {
        id: true,
        openedById: true,
        transaction: {
          select: {
            senderId: true,
            travelerId: true,
          },
        },
      },
    });

    if (!dispute) throw new NotFoundException('Target dispute not found');

    if (
      dispute.openedById === actorUserId ||
      dispute.transaction.senderId === actorUserId ||
      dispute.transaction.travelerId === actorUserId
    ) {
      return;
    }

    throw new ForbiddenException(
      'You cannot create an upload intent for this dispute',
    );
  }

  private async assertCanAccessPayoutTarget(
    actorUserId: string,
    payoutId: string,
  ): Promise<void> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      select: {
        id: true,
        transaction: {
          select: {
            senderId: true,
            travelerId: true,
          },
        },
      },
    });

    if (!payout) throw new NotFoundException('Target payout not found');

    if (
      payout.transaction.senderId === actorUserId ||
      payout.transaction.travelerId === actorUserId
    ) {
      return;
    }

    throw new ForbiddenException(
      'You cannot create an upload intent for this payout',
    );
  }

  private async assertCanAccessRefundTarget(
    actorUserId: string,
    refundId: string,
  ): Promise<void> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      select: {
        id: true,
        transaction: {
          select: {
            senderId: true,
            travelerId: true,
          },
        },
      },
    });

    if (!refund) throw new NotFoundException('Target refund not found');

    if (
      refund.transaction.senderId === actorUserId ||
      refund.transaction.travelerId === actorUserId
    ) {
      return;
    }

    throw new ForbiddenException(
      'You cannot create an upload intent for this refund',
    );
  }

  private async assertCanAccessKycTarget(
    actorUserId: string,
    kycVerificationId: string,
  ): Promise<void> {
    const verification = await this.prisma.kycVerification.findUnique({
      where: { id: kycVerificationId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!verification) {
      throw new NotFoundException('Target KYC verification not found');
    }

    if (verification.userId === actorUserId) return;

    throw new ForbiddenException(
      'You cannot create an upload intent for this KYC target',
    );
  }
}