import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DELETION_GRACE_DAYS = 30;
const KYC_RETENTION_DAYS = 90;

@Injectable()
export class DocumentLifecycleService {
  private readonly logger = new Logger(DocumentLifecycleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initiates soft deletion of personal data.
   * Grace period: 30 days. Does NOT delete ledger/transactions/payouts/disputes.
   */
  async requestDataDeletion(
    userId: string,
  ): Promise<{ status: string; scheduledAt: Date }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new NotFoundException('User not found');

    if ((user as any).deletionStatus === 'DELETION_PENDING') {
      throw new BadRequestException('Deletion already pending for this account');
    }

    const scheduledAt = new Date(
      Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { deletionStatus: 'DELETION_PENDING' } as any,
    });

    this.logger.log(
      `Data deletion requested for user ${userId}, effective at ${scheduledAt}`,
    );

    return { status: 'DELETION_PENDING', scheduledAt };
  }

  /**
   * Executes anonymization after the grace period.
   * Anonymizes email. Financial records are preserved.
   */
  async executeDataDeletion(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new NotFoundException('User not found');

    const anonymizedEmail = `deleted_${userId}@deleted.invalid`;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        deletedAt: new Date(),
        deletionStatus: null,
      } as any,
    });

    // S3 KYC document deletion is scaffolded here.
    // Activate once StorageProvider exposes a deleteFile() method.
    // const kycDocs = await this.prisma.kycVerification.findMany({ where: { userId } });
    // for (const doc of kycDocs) { ... }

    this.logger.log(`Data deletion executed for user ${userId}`);
  }

  /**
   * Nightly KYC retention policy: removes S3 docs 90 days after verification
   * when the related transaction is DELIVERED or CANCELLED.
   * Scaffolded — activate once StorageProvider exposes deleteFile().
   */
  async runKycRetentionCleanup(): Promise<{ cleaned: number }> {
    const cutoff = new Date(
      Date.now() - KYC_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    this.logger.log(
      `KYC retention cleanup — cutoff: ${cutoff.toISOString()}`,
    );

    // Implementation ready to activate once deleteFile() is available:
    // const eligible = await this.prisma.kycVerification.findMany({
    //   where: {
    //     completedAt: { lte: cutoff },
    //     status: 'VERIFIED',
    //     user: {
    //       sentTransactions: {
    //         some: { status: { in: ['DELIVERED', 'CANCELLED'] } },
    //       },
    //     },
    //   },
    // });
    // for (const doc of eligible) { await this.storageService.deleteFile(doc.storageKey); }

    return { cleaned: 0 };
  }

  async logDocumentAccess(params: {
    userId: string;
    documentId: string;
    accessedBy: string;
    endpoint: string;
  }): Promise<void> {
    await this.prisma.documentAccessLog.create({
      data: {
        userId: params.userId,
        documentId: params.documentId,
        accessedBy: params.accessedBy,
        endpoint: params.endpoint,
      },
    });
  }

  async getDocumentAccessLogs(userId: string): Promise<any[]> {
    return this.prisma.documentAccessLog.findMany({
      where: { userId },
      orderBy: { accessedAt: 'desc' },
    });
  }
}
