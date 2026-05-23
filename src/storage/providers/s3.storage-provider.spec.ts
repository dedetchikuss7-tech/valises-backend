import { BadRequestException } from '@nestjs/common';

// Must be hoisted before any import that uses the AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ ETag: '"etag-abc123"' }),
  })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ _type: 'PUT', input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ _type: 'GET', input })),
  HeadObjectCommand: jest.fn().mockImplementation((input) => ({ _type: 'HEAD', input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3StorageProvider } from './s3.storage-provider';

const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

const S3_ENV = {
  S3_BUCKET: 'test-bucket',
  S3_REGION: 'eu-west-1',
  AWS_ACCESS_KEY_ID: 'test-key-id',
  AWS_SECRET_ACCESS_KEY: 'test-secret-key',
};

function buildProvider(): S3StorageProvider {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(S3_ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  const p = new S3StorageProvider();
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return p;
}

describe('S3StorageProvider', () => {
  let provider: S3StorageProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = buildProvider();
    mockGetSignedUrl.mockResolvedValue(
      'https://test-bucket.s3.eu-west-1.amazonaws.com/assets/file.jpg?X-Amz-Signature=sig',
    );
  });

  describe('prepareUpload', () => {
    it('returns a presigned PUT URL with correct shape for an allowed MIME type', async () => {
      const result = await provider.prepareUpload({
        storageKey: 'pending/evidence/pkg-1/photo.jpg',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        kind: 'EVIDENCE_PACKAGE_PHOTO',
      });

      expect(result.provider).toBe('S3');
      expect(result.uploadUrl).toContain('amazonaws.com');
      expect(result.method).toBe('PUT');
      expect(result.expiresInSeconds).toBe(900);
      expect(result.uploadStatus).toBe('PENDING_CLIENT_UPLOAD');
      expect(result.publicUrl).toBeNull();
      expect(result.maxAllowedSizeBytes).toBe(10 * 1024 * 1024);
    });

    it('applies assets/ prefix for non-KYC kinds', async () => {
      const result = await provider.prepareUpload({
        storageKey: 'pending/trip/trip-1/ticket.pdf',
        fileName: 'ticket.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        kind: 'TRIP_FLIGHT_TICKET',
      });

      expect(result.storageKey).toBe('assets/pending/trip/trip-1/ticket.pdf');
      expect(result.providerUploadId).toBe('assets/pending/trip/trip-1/ticket.pdf');
    });

    it('applies kyc/ prefix for KYC kinds', async () => {
      const result = await provider.prepareUpload({
        storageKey: 'pending/kyc/user-1/id.jpg',
        fileName: 'id.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 512,
        kind: 'EVIDENCE_KYC_DOCUMENT',
      });

      expect(result.storageKey).toBe('kyc/pending/kyc/user-1/id.jpg');
      expect(result.providerUploadId).toBe('kyc/pending/kyc/user-1/id.jpg');
    });

    it('throws BadRequestException for a disallowed MIME type', async () => {
      await expect(
        provider.prepareUpload({
          storageKey: 'pending/file.txt',
          fileName: 'file.txt',
          mimeType: 'text/plain',
          sizeBytes: 100,
          kind: 'EVIDENCE_PACKAGE_PHOTO',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('generates the presigned URL with expiresIn=900 seconds', async () => {
      await provider.prepareUpload({
        storageKey: 'pending/evidence/pkg-1/photo.jpg',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        kind: 'EVIDENCE_PACKAGE_PHOTO',
      });

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ expiresIn: 900 }),
      );
    });
  });

  describe('confirmUpload', () => {
    it('returns a presigned GET URL as objectUrl (never a public URL)', async () => {
      mockGetSignedUrl.mockResolvedValueOnce(
        'https://test-bucket.s3.eu-west-1.amazonaws.com/assets/file.jpg?X-Amz-Signature=getsig',
      );

      const result = await provider.confirmUpload({
        storageKey: 'assets/pending/evidence/pkg-1/photo.jpg',
      });

      expect(result.objectUrl).toContain('amazonaws.com');
      expect(result.objectUrl).toContain('X-Amz-Signature');
      expect(result.publicUrl).toBeNull();
      expect(result.confirmed).toBe(true);
      expect(result.uploadStatus).toBe('UPLOADED');
      expect(result.provider).toBe('S3');
    });
  });
});
