import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EvidenceAttachment,
  EvidenceAttachmentStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEvidenceAttachmentDto } from './dto/create-evidence-attachment.dto';
import {
  EvidenceAttachmentSortBy,
  ListEvidenceAttachmentsQueryDto,
  SortOrder,
} from './dto/list-evidence-attachments-query.dto';
import { ReviewEvidenceAttachmentDto } from './dto/review-evidence-attachment.dto';
import { EvidenceAttachmentResponseDto } from './dto/evidence-attachment-response.dto';

@Injectable()
export class EvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    actorUserId: string,
    dto: CreateEvidenceAttachmentDto,
  ): Promise<EvidenceAttachmentResponseDto> {
    const item = await this.prisma.evidenceAttachment.create({
      data: {
        targetType: dto.targetType,
        targetId: dto.targetId,
        attachmentType: dto.attachmentType,
        visibility: dto.visibility,
        uploadedById: actorUserId,
        label: dto.label.trim(),
        fileUrl: dto.fileUrl.trim(),
        storageKey: this.normalizeOptional(dto.storageKey),
        fileName: this.normalizeOptional(dto.fileName),
        mimeType: this.normalizeOptional(dto.mimeType),
        sizeBytes: dto.sizeBytes ?? null,
        metadata: (dto.metadata ?? null) as Prisma.InputJsonValue,
      },
    });

    return this.toResponse(item);
  }

  async list(
    actorUserId: string,
    actorRole: Role,
    query: ListEvidenceAttachmentsQueryDto,
  ) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const where: Prisma.EvidenceAttachmentWhereInput = {
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.attachmentType ? { attachmentType: query.attachmentType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...(actorRole === Role.ADMIN && query.uploadedById
        ? { uploadedById: query.uploadedById }
        : {}),
      ...(actorRole !== Role.ADMIN ? { uploadedById: actorUserId } : {}),
      ...(query.q
        ? {
            OR: [
              { label: { contains: query.q, mode: 'insensitive' } },
              { targetId: { contains: query.q, mode: 'insensitive' } },
              { fileName: { contains: query.q, mode: 'insensitive' } },
              { mimeType: { contains: query.q, mode: 'insensitive' } },
              { fileUrl: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.evidenceAttachment.findMany({
        where,
        orderBy: this.toOrderBy(query.sortBy, query.sortOrder),
        take: limit,
        skip: offset,
      }),
      this.prisma.evidenceAttachment.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      filters: {
        targetType: query.targetType ?? null,
        targetId: query.targetId ?? null,
        attachmentType: query.attachmentType ?? null,
        status: query.status ?? null,
        visibility: query.visibility ?? null,
        uploadedById:
          actorRole === Role.ADMIN ? query.uploadedById ?? null : actorUserId,
        q: query.q ?? null,
      },
    };
  }

  async getOne(
    actorUserId: string,
    actorRole: Role,
    id: string,
  ): Promise<EvidenceAttachmentResponseDto> {
    const item = await this.prisma.evidenceAttachment.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('Evidence attachment not found');
    }

    this.assertCanRead(actorUserId, actorRole, item);

    return this.toResponse(item);
  }

  async review(
    actorUserId: string,
    actorRole: Role,
    id: string,
    dto: ReviewEvidenceAttachmentDto,
  ): Promise<EvidenceAttachmentResponseDto> {
    if (actorRole !== Role.ADMIN) {
      throw new ForbiddenException('Only an admin can review evidence attachments');
    }

    if (dto.status === EvidenceAttachmentStatus.PENDING_REVIEW) {
      throw new BadRequestException(
        'Admin review cannot reset evidence attachment to PENDING_REVIEW',
      );
    }

    const existing = await this.prisma.evidenceAttachment.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Evidence attachment not found');
    }

    const item = await this.prisma.evidenceAttachment.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedByAdminId: actorUserId,
        reviewedAt: new Date(),
        reviewNotes: this.normalizeOptional(dto.reviewNotes),
        rejectionReason:
          dto.status === EvidenceAttachmentStatus.REJECTED
            ? this.normalizeOptional(dto.rejectionReason)
            : null,
      },
    });

    return this.toResponse(item);
  }

  private assertCanRead(
    actorUserId: string,
    actorRole: Role,
    item: EvidenceAttachment,
  ): void {
    if (actorRole === Role.ADMIN) {
      return;
    }

    if (item.uploadedById === actorUserId) {
      return;
    }

    throw new ForbiddenException('You cannot access this evidence attachment');
  }

  private normalizeOptional(value?: string | null): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }

  private toOrderBy(
    sortBy?: EvidenceAttachmentSortBy,
    sortOrder?: SortOrder,
  ): Prisma.EvidenceAttachmentOrderByWithRelationInput[] {
    const direction = sortOrder === SortOrder.ASC ? 'asc' : 'desc';

    switch (sortBy) {
      case EvidenceAttachmentSortBy.UPDATED_AT:
        return [{ updatedAt: direction }, { id: 'desc' }];

      case EvidenceAttachmentSortBy.STATUS:
        return [{ status: direction }, { createdAt: 'desc' }, { id: 'desc' }];

      case EvidenceAttachmentSortBy.TARGET_TYPE:
        return [
          { targetType: direction },
          { createdAt: 'desc' },
          { id: 'desc' },
        ];

      case EvidenceAttachmentSortBy.ATTACHMENT_TYPE:
        return [
          { attachmentType: direction },
          { createdAt: 'desc' },
          { id: 'desc' },
        ];

      case EvidenceAttachmentSortBy.CREATED_AT:
      default:
        return [{ createdAt: direction }, { id: 'desc' }];
    }
  }

  private toResponse(item: EvidenceAttachment): EvidenceAttachmentResponseDto {
    return {
      id: item.id,
      targetType: item.targetType,
      targetId: item.targetId,
      attachmentType: item.attachmentType,
      status: item.status,
      visibility: item.visibility,
      uploadedById: item.uploadedById,
      reviewedByAdminId: item.reviewedByAdminId,
      reviewedAt: item.reviewedAt,
      label: item.label,
      fileUrl: item.fileUrl,
      storageKey: item.storageKey,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      rejectionReason: item.rejectionReason,
      reviewNotes: item.reviewNotes,
      metadata: this.asRecord(item.metadata),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private asRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    if (!value) {
      return null;
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      return { value };
    }

    return value as Record<string, unknown>;
  }
}