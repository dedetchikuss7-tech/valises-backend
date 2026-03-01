import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KycStatus } from '@prisma/client';

@Injectable()
export class KycService {
  constructor(private readonly prisma: PrismaService) {}

  async setUserKycStatus(userId: string, kycStatus: KycStatus) {
    if (!userId) throw new BadRequestException('userId is required');
    if (!kycStatus) throw new BadRequestException('kycStatus is required');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    return this.prisma.user.update({
      where: { id: userId },
      data: { kycStatus },
      select: { id: true, kycStatus: true, updatedAt: true },
    });
  }
}