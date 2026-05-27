import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RateLimitFraudLoggerService {
  private readonly logger = new Logger(RateLimitFraudLoggerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logViolation(userId: string, action: string): Promise<void> {
    try {
      await this.prisma.fraudFlag.create({
        data: {
          userId,
          type: 'RATE_LIMIT_VIOLATION',
          severity: 'LOW',
          description: `Rate limit exceeded for action ${action}`,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to log rate limit fraud flag: ${err.message}`);
    }
  }
}
