import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import { AdminVerifyDecision } from './dto/admin-verify-ticket.dto';

@Injectable()
export class TripService {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(userId: string, dto: CreateTripDto) {
    return this.prisma.trip.create({
      data: {
        carrierId: userId,
        corridorId: dto.corridorId,
        departAt: new Date(dto.departAt),
        capacityKg: dto.capacityKg ?? null,
        status: 'DRAFT',
        flightTicketStatus: 'NOT_PROVIDED',
      },
    });
  }

  async submitTicket(userId: string, tripId: string, _dto: SubmitTicketDto) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.carrierId !== userId) throw new ForbiddenException('Not your trip');
    if (trip.status !== 'DRAFT') throw new BadRequestException('Trip must be DRAFT');

    return this.prisma.trip.update({
      where: { id: tripId },
      data: { flightTicketStatus: 'PROVIDED' },
    });
  }

  async adminVerifyTicket(adminId: string, tripId: string, decision: AdminVerifyDecision) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');

    const next = decision === AdminVerifyDecision.VERIFIED ? 'VERIFIED' : 'REJECTED';

    return this.prisma.trip.update({
      where: { id: tripId },
      data: {
        flightTicketStatus: next as any,
        verifiedAt: decision === AdminVerifyDecision.VERIFIED ? new Date() : null,
        verifiedById: decision === AdminVerifyDecision.VERIFIED ? adminId : null,
      },
    });
  }

  async publish(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.carrierId !== userId) throw new ForbiddenException('Not your trip');
    if (trip.status !== 'DRAFT') throw new BadRequestException('Trip must be DRAFT');

    if (trip.flightTicketStatus !== 'VERIFIED') {
      throw new BadRequestException('Flight ticket must be VERIFIED');
    }

    return this.prisma.trip.update({
      where: { id: tripId },
      data: { status: 'ACTIVE' },
    });
  }

  async findMine(userId: string) {
    return this.prisma.trip.findMany({
      where: { carrierId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}