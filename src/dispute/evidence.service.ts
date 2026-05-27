import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from '../storage/storage.provider';
import {
  EVIDENCE_MAX_FILES,
  EVIDENCE_MAX_SIZE_BYTES,
  getMimeFromFilename,
  isAllowedMime,
} from './evidence-validation';
import { RequestEvidenceUploadDto } from './dto/evidence-upload.dto';

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER)
    private readonly storage: StorageProvider,
  ) {}

  async requestUploadUrl(
    disputeId: string,
    userId: string,
    dto: RequestEvidenceUploadDto,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      select: {
        id: true,
        status: true,
        transaction: {
          select: { senderId: true, travelerId: true },
        },
      },
    });

    if (!dispute) throw new NotFoundException(`Dispute ${disputeId} not found`);

    const isParticipant =
      dispute.transaction.senderId === userId ||
      dispute.transaction.travelerId === userId;

    if (!isParticipant) {
      throw new ForbiddenException(
        'Only transaction participants can upload evidence',
      );
    }

    const mime = getMimeFromFilename(dto.filename);
    if (!mime || !isAllowedMime(mime)) {
      throw new BadRequestException(
        'File type not allowed. Accepted: jpeg, png, webp, pdf',
      );
    }

    const existingCount = await this.prisma.disputeEvidence.count({
      where: { disputeId },
    });

    if (existingCount >= EVIDENCE_MAX_FILES) {
      throw new BadRequestException(
        `Maximum ${EVIDENCE_MAX_FILES} evidence files per dispute`,
      );
    }

    const key = `evidence/${disputeId}/${Date.now()}-${dto.filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

    const uploadResult = await this.storage.prepareUpload({
      storageKey: key,
      fileName: dto.filename,
      mimeType: mime,
      sizeBytes: EVIDENCE_MAX_SIZE_BYTES,
      kind: dto.kind,
    });

    const evidence = await this.prisma.disputeEvidence.create({
      data: {
        disputeId,
        uploadedById: userId,
        storageKey: key,
        mimeType: mime,
        originalFilename: dto.filename,
        fileSizeBytes: null,
      },
      select: {
        id: true,
        storageKey: true,
        mimeType: true,
        originalFilename: true,
      },
    });

    return {
      evidenceId: evidence.id,
      uploadUrl: uploadResult.uploadUrl,
      key,
      maxSizeBytes: EVIDENCE_MAX_SIZE_BYTES,
      contentType: mime,
      expiresInSeconds: uploadResult.expiresInSeconds,
    };
  }

  async getEvidenceList(disputeId: string, requesterId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      select: {
        id: true,
        transaction: {
          select: { senderId: true, travelerId: true },
        },
      },
    });

    if (!dispute) throw new NotFoundException(`Dispute ${disputeId} not found`);

    const isParticipant =
      dispute.transaction.senderId === requesterId ||
      dispute.transaction.travelerId === requesterId;

    if (!isParticipant) {
      throw new ForbiddenException(
        'Only transaction participants can view evidence',
      );
    }

    const evidenceList = await this.prisma.disputeEvidence.findMany({
      where: { disputeId },
      select: {
        id: true,
        originalFilename: true,
        mimeType: true,
        fileSizeBytes: true,
        storageKey: true,
        createdAt: true,
        uploadedById: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    await this.prisma.documentAccessLog.create({
      data: {
        userId: requesterId,
        documentId: disputeId,
        accessedBy: requesterId,
        endpoint: `GET /disputes/${disputeId}/evidence`,
      },
    });

    return evidenceList;
  }
}
