export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

export type StorageUploadMethod = 'PUT' | 'POST';

export interface PrepareUploadInput {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
}

export interface PrepareUploadResult {
  provider: string;
  storageKey: string;
  uploadUrl: string;
  method: StorageUploadMethod;
  headers: Record<string, string>;
  expiresInSeconds: number;
}

export interface ConfirmUploadInput {
  storageKey: string;
}

export interface ConfirmUploadResult {
  provider: string;
  storageKey: string;
  confirmed: boolean;
  confirmedAt: string;
}

export abstract class StorageProvider {
  abstract prepareUpload(
    input: PrepareUploadInput,
  ): Promise<PrepareUploadResult>;

  abstract confirmUpload(
    input: ConfirmUploadInput,
  ): Promise<ConfirmUploadResult>;
}