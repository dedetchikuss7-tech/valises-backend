import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AbandonmentKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AbandonmentService } from '../abandonment/abandonment.service';
import { CreatePackageDto } from './dto/create-package.dto';

@Injectable()
export class PackageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abandonment: AbandonmentService,
  ) {}

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

    if (pkg.status === 'RESERVED') throw new BadRequestException('Cannot cancel a RESERVED package');

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

  async findMine(userId: string) {
    return this.prisma.package.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}