import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DocumentLifecycleService } from './document-lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocumentLifecycleScheduler {
  private readonly logger = new Logger(DocumentLifecycleScheduler.name);

  constructor(
    private readonly documentLifecycleService: DocumentLifecycleService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runDeletionBatch() {
    this.logger.log('Running scheduled data deletion batch');

    const users = await this.prisma.user.findMany({
      where: {
        deletionStatus: 'DELETION_PENDING',
        deletedAt: null,
        updatedAt: {
          lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      } as any,
      select: { id: true },
    });

    for (const user of users) {
      await this.documentLifecycleService.executeDataDeletion(user.id);
    }

    this.logger.log(
      `Deletion batch complete: ${users.length} users processed`,
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async runKycRetentionBatch() {
    this.logger.log('Running KYC retention cleanup batch');
    const result =
      await this.documentLifecycleService.runKycRetentionCleanup();
    this.logger.log(`KYC retention: ${result.cleaned} documents cleaned`);
  }
}
