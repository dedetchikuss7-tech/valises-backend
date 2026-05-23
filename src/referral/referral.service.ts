import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReferralService {
  constructor(private readonly prisma: PrismaService) {}

  async generateCode(userId: string): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code: string;
    let attempts = 0;

    do {
      code = Array.from({ length: 8 }, () =>
        chars.charAt(Math.floor(Math.random() * chars.length)),
      ).join('');
      const existing = await this.prisma.referralCode.findUnique({
        where: { code },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    return code!;
  }

  async getMyCode(userId: string) {
    const existing = await this.prisma.referralCode.findUnique({
      where: { ownerId: userId },
    });
    if (existing) return existing;

    const code = await this.generateCode(userId);
    return this.prisma.referralCode.create({
      data: { ownerId: userId, code },
    });
  }

  async applyReferral(referredUserId: string, code: string) {
    const alreadyUsed = await this.prisma.referralUse.findUnique({
      where: { referredUserId },
    });
    if (alreadyUsed) {
      throw new BadRequestException('You have already applied a referral code.');
    }

    const referralCode = await this.prisma.referralCode.findUnique({
      where: { code },
    });
    if (!referralCode) {
      throw new NotFoundException(`Referral code "${code}" not found.`);
    }

    if (referralCode.ownerId === referredUserId) {
      throw new BadRequestException('You cannot use your own referral code.');
    }

    return this.prisma.referralUse.create({
      data: {
        referralCodeId: referralCode.id,
        referredUserId,
      },
    });
  }

  async getMyReferrals(userId: string) {
    const referralCode = await this.prisma.referralCode.findUnique({
      where: { ownerId: userId },
      include: { uses: true },
    });
    if (!referralCode) return [];
    return referralCode.uses;
  }

  async grantReward(referralUseId: string) {
    const use = await this.prisma.referralUse.findUnique({
      where: { id: referralUseId },
    });
    if (!use) {
      throw new NotFoundException(`ReferralUse "${referralUseId}" not found.`);
    }
    if (use.rewardGranted) {
      throw new BadRequestException('Reward already granted for this referral.');
    }

    return this.prisma.referralUse.update({
      where: { id: referralUseId },
      data: { rewardGranted: true },
    });
  }
}
