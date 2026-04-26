import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AbandonmentKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AbandonmentService } from '../abandonment/abandonment.service';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from '../storage/storage.provider';
import { CreateTripDto } from './dto/create-trip.dto';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import {
  AdminVerifyDecision,
  AdminVerifyTicketDto,
} from './dto/admin-verify-ticket.dto';
import { CreateTripTicketUploadIntentDto } from './dto/create-trip-ticket-upload-intent.dto';

const TRIP_TICKET_MAX_SIZE_BYTES = 10 * 1024 * 1024;

const TRIP_TICKET_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
];

@Injectable()
export class TripService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abandonment: AbandonmentService,
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
  ) {}

  async createDraft(userId: string, dto: CreateTripDto) {
    const trip = await this.prisma.trip.create({
      data: {
        carrierId: userId,
        corridorId: dto.corridorId,
        departAt: new Date(dto.departAt),
        capacityKg: dto.capacityKg ?? null,
        status: 'DRAFT',
        flightTicketStatus: 'NOT_PROVIDED',
      },
    });

    await this.abandonment.markAbandoned(
      { userId, role: 'USER' },
      {
        kind: AbandonmentKind.TRIP_DRAFT,
        tripId: trip.id,
        metadata: {
          step: 'draft_created',
          corridorId: dto.corridorId,
        },
      },
    );

    return trip;
  }

  async createTicketUploadIntent(
    userId: string,
    tripId: string,
    dto: CreateTripTicketUploadIntentDto,
  ) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.carrierId !== userId) {
      throw new ForbiddenException('Not your trip');
    }

    if (trip.status !== 'DRAFT') {
      throw new BadRequestException('Trip must be DRAFT');
    }

    const fileName = this.normalizeRequired(dto.fileName, 'fileName');
    const mimeType = this.normalizeRequired(dto.mimeType, 'mimeType').toLowerCase();

    this.assertTicketFileConstraints({
      fileName,
      mimeType,
      sizeBytes: dto.sizeBytes,
    });

    const storageKey = this.buildTicketStorageKey({
      tripId,
      userId,
      fileName,
    });

    const upload = await this.storageProvider.prepareUpload({
      storageKey,
      fileName,
      mimeType,
      sizeBytes: dto.sizeBytes,
      kind: 'TRIP_FLIGHT_TICKET',
    });

    return {
      tripId,
      fileName,
      mimeType,
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
      allowedMimeTypes: TRIP_TICKET_ALLOWED_MIME_TYPES,
      nextStep:
        'Upload the ticket file to uploadUrl using the returned method and headers, then submit the ticket metadata through PATCH /trips/:id/submit-ticket.',
    };
  }

  async submitTicket(userId: string, tripId: string, dto: SubmitTicketDto) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.carrierId !== userId) {
      throw new ForbiddenException('Not your trip');
    }

    if (trip.status !== 'DRAFT') {
      throw new BadRequestException('Trip must be DRAFT');
    }

    const fileName = this.normalizeRequired(dto.fileName, 'fileName');
    const mimeType = this.normalizeRequired(dto.mimeType, 'mimeType').toLowerCase();
    const storageKey = this.normalizeRequired(dto.storageKey, 'storageKey');
    const provider = this.normalizeRequired(dto.provider, 'provider');

    this.assertTicketFileConstraints({
      fileName,
      mimeType,
      sizeBytes: dto.sizeBytes,
    });

    const updated = await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        flightTicketStatus: 'PROVIDED',
        flightTicketRef: this.normalizeOptional(dto.ticketRef),
        flightTicketFileName: fileName,
        flightTicketMimeType: mimeType,
        flightTicketSizeBytes: dto.sizeBytes,
        flightTicketProvider: provider,
        flightTicketProviderUploadId: this.normalizeOptional(dto.providerUploadId),
        flightTicketStorageKey: storageKey,
        flightTicketObjectUrl: this.normalizeOptional(dto.objectUrl),
        flightTicketPublicUrl: this.normalizeOptional(dto.publicUrl),
        flightTicketSubmittedAt: new Date(),
        flightTicketSubmittedById: userId,
        flightTicketRejectionReason: null,
        flightTicketReviewNotes: null,
        verifiedAt: null,
        verifiedById: null,
      },
    });

    await this.abandonment.markAbandoned(
      { userId, role: 'USER' },
      {
        kind: AbandonmentKind.TRIP_DRAFT,
        tripId: trip.id,
        metadata: {
          step: 'ticket_submitted',
          flightTicketStatus: 'PROVIDED',
          fileName,
          mimeType,
          sizeBytes: dto.sizeBytes,
        },
      },
    );

    return updated;
  }

  async adminVerifyTicket(
    adminId: string,
    tripId: string,
    dto: AdminVerifyTicketDto,
  ) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.flightTicketStatus === 'NOT_PROVIDED') {
      throw new BadRequestException('Flight ticket must be submitted first');
    }

    const decision = dto.decision;
    const next =
      decision === AdminVerifyDecision.VERIFIED ? 'VERIFIED' : 'REJECTED';

    const updated = await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        flightTicketStatus: next as any,
        verifiedAt:
          decision === AdminVerifyDecision.VERIFIED ? new Date() : null,
        verifiedById:
          decision === AdminVerifyDecision.VERIFIED ? adminId : null,
        flightTicketReviewNotes: this.normalizeOptional(dto.reviewNotes),
        flightTicketRejectionReason:
          decision === AdminVerifyDecision.REJECTED
            ? this.normalizeOptional(dto.rejectionReason)
            : null,
      },
    });

    if (decision === AdminVerifyDecision.REJECTED) {
      await this.abandonment.markAbandoned(
        { userId: trip.carrierId, role: 'USER' },
        {
          kind: AbandonmentKind.TRIP_DRAFT,
          tripId: trip.id,
          metadata: {
            step: 'ticket_rejected',
            reviewedBy: adminId,
            rejectionReason: this.normalizeOptional(dto.rejectionReason),
          },
        },
      );
    }

    return updated;
  }

  async publish(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.carrierId !== userId) {
      throw new ForbiddenException('Not your trip');
    }

    if (trip.status !== 'DRAFT') {
      throw new BadRequestException('Trip must be DRAFT');
    }

    if (trip.flightTicketStatus !== 'VERIFIED') {
      throw new BadRequestException('Flight ticket must be VERIFIED');
    }

    const updated = await this.prisma.trip.update({
      where: { id: tripId },
      data: { status: 'ACTIVE' },
    });

    await this.abandonment.resolveActiveByReference({
      userId,
      kind: AbandonmentKind.TRIP_DRAFT,
      tripId: trip.id,
    });

    return updated;
  }

  async findMine(userId: string) {
    return this.prisma.trip.findMany({
      where: { carrierId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private assertTicketFileConstraints(input: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }): void {
    if (!TRIP_TICKET_ALLOWED_MIME_TYPES.includes(input.mimeType)) {
      throw new BadRequestException(
        `Unsupported flight ticket mimeType. Allowed values: ${TRIP_TICKET_ALLOWED_MIME_TYPES.join(
          ', ',
        )}`,
      );
    }

    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
      throw new BadRequestException('sizeBytes must be a positive integer');
    }

    if (input.sizeBytes > TRIP_TICKET_MAX_SIZE_BYTES) {
      throw new BadRequestException(
        `Flight ticket file is too large. Max size is ${TRIP_TICKET_MAX_SIZE_BYTES} bytes`,
      );
    }
  }

  private buildTicketStorageKey(input: {
    tripId: string;
    userId: string;
    fileName: string;
  }): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    return [
      'pending',
      'trips',
      this.safeSegment(input.tripId),
      'flight-ticket',
      this.safeSegment(input.userId),
      `${timestamp}-${this.safeFileName(input.fileName)}`,
    ].join('/');
  }

  private safeSegment(value: string): string {
    const safe = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/_/g, '-')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
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

  private normalizeOptional(value?: string | null): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }
}