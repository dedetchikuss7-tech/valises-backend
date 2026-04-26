import { Inject, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from '../storage/storage.provider';
import { EvidenceService } from './evidence.service';
import { ConfirmEvidenceUploadDto } from './dto/confirm-evidence-upload.dto';
import { EvidenceAttachmentResponseDto } from './dto/evidence-attachment-response.dto';

@Injectable()
export class EvidenceUploadConfirmationService {
  constructor(
    private readonly evidenceService: EvidenceService,
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
  ) {}

  async confirmUploadAndCreateAttachment(
    actorUserId: string,
    actorRole: Role,
    dto: ConfirmEvidenceUploadDto,
  ): Promise<EvidenceAttachmentResponseDto> {
    const confirmation = await this.storageProvider.confirmUpload({
      storageKey: dto.storageKey,
    });

    return this.evidenceService.create(actorUserId, actorRole, {
      targetType: dto.targetType,
      targetId: dto.targetId,
      attachmentType: dto.attachmentType,
      visibility: dto.visibility,
      label: dto.label,
      provider: confirmation.provider,
      providerUploadId: confirmation.providerUploadId ?? undefined,
      storageKey: confirmation.storageKey,
      objectUrl: confirmation.objectUrl ?? undefined,
      publicUrl: confirmation.publicUrl ?? undefined,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      metadata: {
        ...(dto.metadata ?? {}),
        uploadConfirmation: {
          confirmed: confirmation.confirmed,
          confirmedAt: confirmation.confirmedAt,
          uploadStatus: confirmation.uploadStatus,
          checksum: confirmation.checksum,
        },
      },
    });
  }
}