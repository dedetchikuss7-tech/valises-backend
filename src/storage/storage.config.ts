import { StorageProviderName } from './storage.provider';

export const STORAGE_PROVIDER_ENV_KEY = 'STORAGE_PROVIDER';

const SUPPORTED_STORAGE_PROVIDERS = new Set<string>(
  Object.values(StorageProviderName),
);

const IMPLEMENTED_STORAGE_PROVIDERS = new Set<string>([
  StorageProviderName.MOCK_STORAGE,
]);

export function resolveStorageProviderName(
  rawValue?: string | null,
): StorageProviderName {
  const normalized = String(rawValue ?? StorageProviderName.MOCK_STORAGE)
    .trim()
    .toUpperCase();

  if (!normalized) {
    return StorageProviderName.MOCK_STORAGE;
  }

  if (!SUPPORTED_STORAGE_PROVIDERS.has(normalized)) {
    throw new Error(
      `Unsupported ${STORAGE_PROVIDER_ENV_KEY}: ${normalized}. Supported values are: ${Array.from(
        SUPPORTED_STORAGE_PROVIDERS,
      ).join(', ')}`,
    );
  }

  if (!IMPLEMENTED_STORAGE_PROVIDERS.has(normalized)) {
    throw new Error(
      `${STORAGE_PROVIDER_ENV_KEY}=${normalized} is reserved for production storage integration but is not implemented yet. Use ${StorageProviderName.MOCK_STORAGE} for local/dev/test.`,
    );
  }

  return normalized as StorageProviderName;
}

export function isStorageProviderImplemented(
  providerName: StorageProviderName,
): boolean {
  return IMPLEMENTED_STORAGE_PROVIDERS.has(providerName);
}

export function getSupportedStorageProviderNames(): StorageProviderName[] {
  return Object.values(StorageProviderName);
}

export function getImplementedStorageProviderNames(): StorageProviderName[] {
  return Array.from(IMPLEMENTED_STORAGE_PROVIDERS) as StorageProviderName[];
}