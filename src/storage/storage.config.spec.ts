import {
  getImplementedStorageProviderNames,
  getSupportedStorageProviderNames,
  isStorageProviderImplemented,
  resolveStorageProviderName,
  STORAGE_PROVIDER_ENV_KEY,
} from './storage.config';
import { StorageProviderName } from './storage.provider';

describe('storage.config', () => {
  it('defaults to MOCK_STORAGE when env value is missing', () => {
    expect(resolveStorageProviderName(undefined)).toBe(
      StorageProviderName.MOCK_STORAGE,
    );
    expect(resolveStorageProviderName(null)).toBe(
      StorageProviderName.MOCK_STORAGE,
    );
    expect(resolveStorageProviderName('')).toBe(StorageProviderName.MOCK_STORAGE);
  });

  it('normalizes provider value to uppercase', () => {
    expect(resolveStorageProviderName('mock_storage')).toBe(
      StorageProviderName.MOCK_STORAGE,
    );
    expect(resolveStorageProviderName(' MOCK_STORAGE ')).toBe(
      StorageProviderName.MOCK_STORAGE,
    );
  });

  it('throws for unsupported provider values', () => {
    expect(() => resolveStorageProviderName('LOCAL_DISK')).toThrow(
      `Unsupported ${STORAGE_PROVIDER_ENV_KEY}: LOCAL_DISK`,
    );
  });

  it('throws for known but not yet implemented production providers', () => {
    expect(() => resolveStorageProviderName('S3')).toThrow(
      `${STORAGE_PROVIDER_ENV_KEY}=S3 is reserved for production storage integration but is not implemented yet`,
    );

    expect(() => resolveStorageProviderName('CLOUDINARY')).toThrow(
      `${STORAGE_PROVIDER_ENV_KEY}=CLOUDINARY is reserved for production storage integration but is not implemented yet`,
    );

    expect(() => resolveStorageProviderName('SUPABASE')).toThrow(
      `${STORAGE_PROVIDER_ENV_KEY}=SUPABASE is reserved for production storage integration but is not implemented yet`,
    );

    expect(() => resolveStorageProviderName('MANUAL')).toThrow(
      `${STORAGE_PROVIDER_ENV_KEY}=MANUAL is reserved for production storage integration but is not implemented yet`,
    );
  });

  it('exposes supported and implemented providers', () => {
    expect(getSupportedStorageProviderNames()).toEqual([
      StorageProviderName.MOCK_STORAGE,
      StorageProviderName.S3,
      StorageProviderName.CLOUDINARY,
      StorageProviderName.SUPABASE,
      StorageProviderName.MANUAL,
    ]);

    expect(getImplementedStorageProviderNames()).toEqual([
      StorageProviderName.MOCK_STORAGE,
    ]);

    expect(
      isStorageProviderImplemented(StorageProviderName.MOCK_STORAGE),
    ).toBe(true);
    expect(isStorageProviderImplemented(StorageProviderName.S3)).toBe(false);
  });
});