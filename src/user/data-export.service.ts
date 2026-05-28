import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  GoneException,
} from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../prisma/prisma.service';

const EXPORT_URL_EXPIRY_HOURS = 24;
const EXPORT_URL_EXPIRY_SECONDS = EXPORT_URL_EXPIRY_HOURS * 3600;

@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async requestExport(userId: string): Promise<{ exportRequestId: string; status: string }> {
    const existing = await this.prisma.dataExportRequest.findFirst({
      where: { userId, status: { in: ['PENDING', 'PROCESSING'] } },
      select: { id: true, status: true },
    });

    if (existing) {
      throw new ConflictException(
        'A data export is already in progress. Please wait for it to complete.',
      );
    }

    const exportRequest = await this.prisma.dataExportRequest.create({
      data: { userId, status: 'PENDING' },
      select: { id: true, status: true },
    });

    this.processExport(exportRequest.id, userId).catch((err) => {
      this.logger.error(`Export processing failed for ${exportRequest.id}: ${err.message}`);
    });

    return { exportRequestId: exportRequest.id, status: 'PENDING' };
  }

  private async processExport(exportRequestId: string, userId: string): Promise<void> {
    try {
      await this.prisma.dataExportRequest.update({
        where: { id: exportRequestId },
        data: { status: 'PROCESSING' },
      });

      const exportData = await this.gatherUserData(userId);
      const jsonContent = JSON.stringify(exportData, null, 2);
      const s3Key = `exports/${userId}/${exportRequestId}/data-export.json`;

      const expiresAt = new Date(Date.now() + EXPORT_URL_EXPIRY_HOURS * 60 * 60 * 1000);
      const downloadUrl = await this.uploadAndSign(s3Key, jsonContent);

      await this.prisma.dataExportRequest.update({
        where: { id: exportRequestId },
        data: {
          status: 'READY',
          s3Key,
          downloadUrl,
          expiresAt,
          completedAt: new Date(),
        },
      });

      this.logger.log(`Data export ready: exportId=${exportRequestId} userId=${userId}`);
    } catch (err: any) {
      await this.prisma.dataExportRequest
        .update({ where: { id: exportRequestId }, data: { status: 'FAILED' } })
        .catch(() => {});
      throw err;
    }
  }

  private async uploadAndSign(s3Key: string, jsonContent: string): Promise<string> {
    const storageProvider = process.env.STORAGE_PROVIDER ?? 'MOCK_STORAGE';

    if (storageProvider === 'S3') {
      const bucket = process.env.S3_BUCKET!;
      const region = process.env.S3_REGION!;
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID!;
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY!;

      const s3 = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: Buffer.from(jsonContent),
          ContentType: 'application/json',
        }),
      );

      return getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucket, Key: s3Key }),
        { expiresIn: EXPORT_URL_EXPIRY_SECONDS },
      );
    }

    // MOCK_STORAGE fallback
    const encoded = encodeURIComponent(s3Key);
    return `https://mock-storage.local/export/${encoded}?token=mock-24h`;
  }

  private async gatherUserData(userId: string): Promise<Record<string, any>> {
    const [user, transactions, reviews] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          kycStatus: true,
          createdAt: true,
        },
      }),
      this.prisma.transaction.findMany({
        where: { senderId: userId },
        select: {
          id: true,
          status: true,
          createdAt: true,
          deliveryConfirmedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      this.prisma.review.findMany({
        where: { reviewerId: userId },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: user,
      transactions,
      reviewsGiven: reviews,
    };
  }

  async getDownloadUrl(
    exportRequestId: string,
    userId: string,
  ): Promise<{ downloadUrl: string; expiresAt: string }> {
    const exportRequest = await this.prisma.dataExportRequest.findUnique({
      where: { id: exportRequestId },
      select: {
        id: true,
        userId: true,
        status: true,
        downloadUrl: true,
        expiresAt: true,
        accessCount: true,
      },
    });

    if (!exportRequest || exportRequest.userId !== userId) {
      throw new NotFoundException('Export request not found');
    }

    if (exportRequest.status !== 'READY') {
      throw new ConflictException(`Export is ${exportRequest.status}, not ready yet`);
    }

    if (exportRequest.accessCount >= 1) {
      throw new GoneException('Download link has already been used. Request a new export.');
    }

    await this.prisma.dataExportRequest.update({
      where: { id: exportRequestId },
      data: { accessCount: { increment: 1 } },
    });

    this.prisma.auditAccessLog
      .create({
        data: {
          accessedById: userId,
          targetType: 'DATA_EXPORT',
          targetId: exportRequestId,
          endpoint: `GET /me/data/export/${exportRequestId}`,
          accessedAt: new Date(),
        },
      })
      .catch(() => {});

    return {
      downloadUrl: exportRequest.downloadUrl!,
      expiresAt: exportRequest.expiresAt!.toISOString(),
    };
  }
}
