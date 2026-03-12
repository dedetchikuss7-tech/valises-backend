import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AbandonmentKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AbandonmentService } from '../abandonment/abandonment.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import { AdminVerifyDecision } from './dto/admin-verify-ticket.dto';

@Injectable()
export class TripService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abandonment: AbandonmentService,
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

  async submitTicket(userId: string, tripId: string, _dto: SubmitTicketDto) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.carrierId !== userId) throw new ForbiddenException('Not your trip');
    if (trip.status !== 'DRAFT') throw new BadRequestException('Trip must be DRAFT');

    const updated = await this.prisma.trip.update({
      where: { id: tripId },
      data: { flightTicketStatus: 'PROVIDED' },
    });

    await this.abandonment.markAbandoned(
      { userId, role: 'USER' },
      {
        kind: AbandonmentKind.TRIP_DRAFT,
        tripId: trip.id,
        metadata: {
          step: 'ticket_submitted',
          flightTicketStatus: 'PROVIDED',
        },
      },
    );

    return updated;
  }

  async adminVerifyTicket(adminId: string, tripId: string, decision: AdminVerifyDecision) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');

    const next = decision === AdminVerifyDecision.VERIFIED ? 'VERIFIED' : 'REJECTED';

    const updated = await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        flightTicketStatus: next as any,
        verifiedAt: decision === AdminVerifyDecision.VERIFIED ? new Date() : null,
        verifiedById: decision === AdminVerifyDecision.VERIFIED ? adminId : null,
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
          },
        },
      );
    }

    return updated;
  }

  async publish(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.carrierId !== userId) throw new ForbiddenException('Not your trip');
    if (trip.status !== 'DRAFT') throw new BadRequestException('Trip must be DRAFT');

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
}