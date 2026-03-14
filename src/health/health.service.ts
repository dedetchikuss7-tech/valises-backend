import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus() {
    const startedAt = new Date().toISOString();

    let database = 'down';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    const isReady = database === 'up';

    return {
      ok: isReady,
      service: 'valises-backend',
      timestamp: startedAt,
      checks: {
        api: 'up',
        database,
      },
    };
  }
}