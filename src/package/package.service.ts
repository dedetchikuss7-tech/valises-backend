import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AbandonmentKind, Role, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AbandonmentService } from '../abandonment/abandonment.service';
import { CreatePackageDto } from './dto/create-package.dto';

@Injectable()
export class PackageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abandonment: AbandonmentService,
  ) {}

  private normalizeOptionalNotes(notes?: string): string | null {
    const value = String(notes ?? '').trim();

    if (!value) {
      return null;
    }

    if (value.length > 1000) {
      throw new BadRequestException(
        'handover notes must not exceed 1000 characters',
      );
    }

    return value;
  }

  async createDraft(userId: string, dto: CreatePackageDto) {
    const pkg = await this.prisma.package.create({
      data: {
        senderId: userId,
        corridorId: dto.corridorId,
        weightKg: dto.weightKg ?? null,
        description: dto.description ?? null,
        status: 'DRAFT',
      },
    });

    await this.abandonment.markAbandoned(
      { userId, role: 'USER' },
      {
        kind: AbandonmentKind.PACKAGE_DRAFT,
        packageId: pkg.id,
        metadata: {
          step: 'draft_created',
          corridorId: dto.corridorId,
        },
      },
    );

    return pkg;
  }

  async publish(userId: string, packageId: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.senderId !== userId) throw new ForbiddenException('Not your package');
    if (pkg.status !== 'DRAFT') throw new BadRequestException('Package must be DRAFT');

    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: { status: 'PUBLISHED' },
    });

    await this.abandonment.resolveActiveByReference({
      userId,
      kind: AbandonmentKind.PACKAGE_DRAFT,
      packageId: pkg.id,
    });

    return updated;
  }

  async cancel(userId: string, packageId: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.senderId !== userId) throw new ForbiddenException('Not your package');
    if (pkg.status === 'CANCELLED') return pkg;

    if (pkg.status === 'RESERVED') {
      throw new BadRequestException('Cannot cancel a RESERVED package');
    }

    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: { status: 'CANCELLED' },
    });

    await this.abandonment.resolveActiveByReference({
      userId,
      kind: AbandonmentKind.PACKAGE_DRAFT,
      packageId: pkg.id,
    });

    return updated;
  }

  async declareHandover(
    actorUserId: string,
    actorRole: Role,
    packageId: string,
    notes?: string,
  ) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        senderId: true,
        status: true,
        handoverDeclaredAt: true,
        handoverDeclaredById: true,
        handoverNotes: true,
      },
    });

    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    if (actorRole !== Role.ADMIN && pkg.senderId !== actorUserId) {
      throw new ForbiddenException(
        'Only the sender or an admin can declare package handover',
      );
    }

    if (pkg.status === 'DRAFT') {
      throw new BadRequestException(
        'Cannot declare handover for a DRAFT package',
      );
    }

    if (pkg.status === 'CANCELLED') {
      throw new BadRequestException(
        'Cannot declare handover for a CANCELLED package',
      );
    }

    const now = new Date();

    return this.prisma.package.update({
      where: { id: packageId },
      data: {
        handoverDeclaredAt: now,
        handoverDeclaredById: actorUserId,
        handoverNotes: this.normalizeOptionalNotes(notes),
      },
    });
  }

  async acknowledgeTravelerResponsibility(
    actorUserId: string,
    actorRole: Role,
    packageId: string,
  ) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    if (pkg.status === 'DRAFT') {
      throw new BadRequestException(
        'Cannot acknowledge traveler responsibility for a DRAFT package',
      );
    }

    if (pkg.status === 'CANCELLED') {
      throw new BadRequestException(
        'Cannot acknowledge traveler responsibility for a CANCELLED package',
      );
    }

    const linkedTransaction = await this.prisma.transaction.findFirst({
      where: {
        packageId,
        NOT: { status: TransactionStatus.CANCELLED },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        travelerId: true,
      },
    });

    if (!linkedTransaction) {
      throw new BadRequestException(
        'Package is not linked to an active transaction',
      );
    }

    if (
      actorRole !== Role.ADMIN &&
      linkedTransaction.travelerId !== actorUserId
    ) {
      throw new ForbiddenException(
        'Only the traveler or an admin can acknowledge traveler responsibility',
      );
    }

    const now = new Date();

    return this.prisma.package.update({
      where: { id: packageId },
      data: {
        travelerResponsibilityAcknowledgedAt: now,
        travelerResponsibilityAcknowledgedById: actorUserId,
      },
    });
  }

  async findMine(userId: string) {
    return this.prisma.package.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}