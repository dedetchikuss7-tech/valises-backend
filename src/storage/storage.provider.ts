export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

export type StorageUploadMethod = 'PUT' | 'POST';
export type StorageUploadStatus = 'PENDING_CLIENT_UPLOAD' | 'UPLOADED';
export type StorageProviderName = 'MOCK_STORAGE';

export interface PrepareUploadInput {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
}

export interface PrepareUploadResult {
  provider: StorageProviderName;
  storageKey: string;
  uploadUrl: string;
  method: StorageUploadMethod;
  headers: Record<string, string>;
  expiresInSeconds: number;

  uploadStatus: StorageUploadStatus;
  providerUploadId: string | null;
  objectUrl: string | null;
  publicUrl: string | null;
  maxAllowedSizeBytes: number | null;
}

export interface ConfirmUploadInput {
  storageKey: string;
}

export interface ConfirmUploadResult {
  provider: StorageProviderName;
  storageKey: string;
  confirmed: boolean;
  confirmedAt: string;

  uploadStatus: StorageUploadStatus;
  providerUploadId: string | null;
  objectUrl: string | null;
  publicUrl: string | null;
  checksum: string | null;
}

export abstract class StorageProvider {
  abstract prepareUpload(
    input: PrepareUploadInput,
  ): Promise<PrepareUploadResult>;

  abstract confirmUpload(
    input: ConfirmUploadInput,
  ): Promise<ConfirmUploadResult>;
}