import { Test, TestingModule } from '@nestjs/testing';
import { MockStorageProvider } from './mock-storage.provider';
import { StorageModule } from './storage.module';
import {
  STORAGE_PROVIDER,
  StorageProvider,
  StorageProviderName,
} from './storage.provider';

describe('StorageModule', () => {
  const originalStorageProviderEnv = process.env.STORAGE_PROVIDER;

  afterEach(() => {
    if (originalStorageProviderEnv === undefined) {
      delete process.env.STORAGE_PROVIDER;
    } else {
      process.env.STORAGE_PROVIDER = originalStorageProviderEnv;
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

  it('fails fast when a future production provider is selected before implementation', async () => {
    process.env.STORAGE_PROVIDER = 'S3';

    await expect(compileModule()).rejects.toThrow(
      'STORAGE_PROVIDER=S3 is reserved for production storage integration but is not implemented yet',
    );
  });

  it('fails fast when an unsupported provider is selected', async () => {
    process.env.STORAGE_PROVIDER = 'LOCAL_DISK';

    await expect(compileModule()).rejects.toThrow(
      'Unsupported STORAGE_PROVIDER: LOCAL_DISK',
    );
  });
});