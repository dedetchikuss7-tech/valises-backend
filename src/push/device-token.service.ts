import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeviceTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async registerToken(
    userId: string,
    token: string,
    platform: 'IOS' | 'ANDROID',
  ): Promise<void> {
    await this.prisma.deviceToken.upsert({
      where: { userId_token: { userId, token } },
      create: { userId, token, platform },
      update: { platform, updatedAt: new Date() },
    });
  }

  async unregisterToken(userId: string, token: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({
      where: { userId, token },
    });
  }

  async unregisterAllForUser(userId: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({ where: { userId } });
  }

  async getTokensForUser(
    userId: string,
  ): Promise<Array<{ id: string; token: string; platform: string }>> {
    return this.prisma.deviceToken.findMany({
      where: { userId },
      select: { id: true, token: true, platform: true },
    });
  }

  async removeInvalidToken(token: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({ where: { token } });
  }
}
