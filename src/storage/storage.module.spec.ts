import { Test, TestingModule } from '@nestjs/testing';
import { MockStorageProvider } from './mock-storage.provider';
import { S3StorageProvider } from './providers/s3.storage-provider';
import { StorageModule } from './storage.module';
import {
  STORAGE_PROVIDER,
  StorageProvider,
  StorageProviderName,
} from './storage.provider';

describe('StorageModule', () => {
  const originalEnv: Record<string, string | undefined> = {};

  const S3_TEST_ENV = {
    STORAGE_PROVIDER: 'S3',
    S3_BUCKET: 'test-bucket',
    S3_REGION: 'eu-west-1',
    AWS_ACCESS_KEY_ID: 'test-key-id',
    AWS_SECRET_ACCESS_KEY: 'test-secret-key',
  };

  beforeEach(() => {
    for (const key of ['STORAGE_PROVIDER', ...Object.keys(S3_TEST_ENV)]) {
      originalEnv[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  async function compileModule(): Promise<TestingModule> {
    return Test.createTestingModule({
      imports: [StorageModule],
    }).compile();
  }

  it('provides MockStorageProvider by default', async () => {
    delete process.env.STORAGE_PROVIDER;

    const module = await compileModule();
    const provider = module.get<StorageProvider>(STORAGE_PROVIDER);

    expect(provider).toBeInstanceOf(MockStorageProvider);

    const upload = await provider.prepareUpload({
      storageKey: 'pending/evidence/package/pkg-1/photo.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 12345,
      kind: 'EVIDENCE_PACKAGE_PHOTO',
    });

    expect(upload.provider).toBe(StorageProviderName.MOCK_STORAGE);
    expect(upload.uploadStatus).toBe('PENDING_CLIENT_UPLOAD');
    expect(upload.uploadUrl).toContain('mock-storage.local');
  });

  it('provides MockStorageProvider when STORAGE_PROVIDER=MOCK_STORAGE', async () => {
    process.env.STORAGE_PROVIDER = 'MOCK_STORAGE';

    const module = await compileModule();
    const provider = module.get<StorageProvider>(STORAGE_PROVIDER);

    expect(provider).toBeInstanceOf(MockStorageProvider);
  });

  it('provides S3StorageProvider when STORAGE_PROVIDER=S3 and AWS vars are set', async () => {
    Object.assign(process.env, S3_TEST_ENV);

    const module = await compileModule();
    const provider = module.get<StorageProvider>(STORAGE_PROVIDER);

    expect(provider).toBeInstanceOf(S3StorageProvider);
  });

  it('fails fast when a future production provider is selected before implementation', async () => {
    process.env.STORAGE_PROVIDER = 'CLOUDINARY';

    await expect(compileModule()).rejects.toThrow(
      'STORAGE_PROVIDER=CLOUDINARY is reserved for production storage integration but is not implemented yet',
    );
  });

  it('fails fast when an unsupported provider is selected', async () => {
    process.env.STORAGE_PROVIDER = 'LOCAL_DISK';

    await expect(compileModule()).rejects.toThrow(
      'Unsupported STORAGE_PROVIDER: LOCAL_DISK',
    );
  });
});