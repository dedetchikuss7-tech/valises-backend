import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePackageDto } from './dto/create-package.dto';

@Injectable()
export class PackageService {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(userId: string, dto: CreatePackageDto) {
    return this.prisma.package.create({
      data: {
        senderId: userId,
        corridorId: dto.corridorId,
        weightKg: dto.weightKg ?? null,
        description: dto.description ?? null,
        status: 'DRAFT',
      },
    });
  }

  async publish(userId: string, packageId: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.senderId !== userId) throw new ForbiddenException('Not your package');
    if (pkg.status !== 'DRAFT') throw new BadRequestException('Package must be DRAFT');

    return this.prisma.package.update({
      where: { id: packageId },
      data: { status: 'PUBLISHED' },
    });
  }

  async cancel(userId: string, packageId: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.senderId !== userId) throw new ForbiddenException('Not your package');
    if (pkg.status === 'CANCELLED') return pkg;

    if (pkg.status === 'RESERVED') throw new BadRequestException('Cannot cancel a RESERVED package');

    return this.prisma.package.update({
      where: { id: packageId },
      data: { status: 'CANCELLED' },
    });
  }

  async findMine(userId: string) {
    return this.prisma.package.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}