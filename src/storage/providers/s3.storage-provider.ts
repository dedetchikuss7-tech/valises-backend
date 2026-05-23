import { BadRequestException, Injectable } from '@nestjs/common';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  ConfirmUploadInput,
  ConfirmUploadResult,
  PrepareUploadInput,
  PrepareUploadResult,
  StorageProvider,
  StorageProviderName,
} from '../storage.provider';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

// S3 presigned PUT does not support Content-Length-Range (that requires presigned POST multipart).
// The 10 MB ceiling is enforced here before the presigned URL is issued.
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const PRESIGNED_EXPIRY_SECONDS = 900;

@Injectable()
export class S3StorageProvider extends StorageProvider {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor() {
    super();
    this.bucket = this.requireEnv('S3_BUCKET');
    const region = this.requireEnv('S3_REGION');
    const accessKeyId = this.requireEnv('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.requireEnv('AWS_SECRET_ACCESS_KEY');

    this.s3 = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  private requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`S3StorageProvider: missing required env var ${key}`);
    }
    return value;
  }

  private buildS3Key(storageKey: string, kind: string): string {
    const prefix = kind.toUpperCase().includes('KYC') ? 'kyc' : 'assets';
    return `${prefix}/${storageKey}`;
  }

  async prepareUpload(input: PrepareUploadInput): Promise<PrepareUploadResult> {
    if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
      throw new BadRequestException(
        `MIME type "${input.mimeType}" is not allowed. Allowed: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`,
      );
    }

    const s3Key = this.buildS3Key(input.storageKey, input.kind);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: input.mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: PRESIGNED_EXPIRY_SECONDS,
    });

    return {
      provider: StorageProviderName.S3,
      storageKey: s3Key,
      uploadUrl,
      method: 'PUT',
      headers: { 'content-type': input.mimeType },
      expiresInSeconds: PRESIGNED_EXPIRY_SECONDS,
      uploadStatus: 'PENDING_CLIENT_UPLOAD',
      providerUploadId: s3Key,
      objectUrl: null,
      publicUrl: null,
      maxAllowedSizeBytes: MAX_SIZE_BYTES,
    };
  }

  async confirmUpload(input: ConfirmUploadInput): Promise<ConfirmUploadResult> {
    // storageKey is the full S3 key returned by prepareUpload (already includes kyc/ or assets/ prefix)
    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: input.storageKey }),
    );

    const objectUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: input.storageKey }),
      { expiresIn: PRESIGNED_EXPIRY_SECONDS },
    );

    return {
      provider: StorageProviderName.S3,
      storageKey: input.storageKey,
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      uploadStatus: 'UPLOADED',
      providerUploadId: input.storageKey,
      objectUrl,
      publicUrl: null,
      checksum: head.ETag ?? null,
    };
  }
}
