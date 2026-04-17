import { Injectable } from '@nestjs/common';
import {
  ConfirmUploadInput,
  ConfirmUploadResult,
  PrepareUploadInput,
  PrepareUploadResult,
  StorageProvider,
} from './storage.provider';

@Injectable()
export class MockStorageProvider implements StorageProvider {
  private buildObjectUrl(storageKey: string): string {
    const encodedStorageKey = encodeURIComponent(storageKey);
    return `https://mock-storage.local/object/${encodedStorageKey}`;
  }

  private buildUploadUrl(storageKey: string): string {
    const encodedStorageKey = encodeURIComponent(storageKey);
    return `https://mock-storage.local/upload/${encodedStorageKey}?token=abc`;
  }

  private buildProviderUploadId(storageKey: string): string {
    return `mock-upload:${storageKey}`;
  }

  async prepareUpload(
    input: PrepareUploadInput,
  ): Promise<PrepareUploadResult> {
    return {
      provider: 'MOCK_STORAGE',
      storageKey: input.storageKey,
      uploadUrl: this.buildUploadUrl(input.storageKey),
      method: 'PUT',
      headers: {
        'content-type': input.mimeType,
        'x-mock-upload-token': 'abc',
      },
      expiresInSeconds: 900,

      uploadStatus: 'PENDING_CLIENT_UPLOAD',
      providerUploadId: this.buildProviderUploadId(input.storageKey),
      objectUrl: this.buildObjectUrl(input.storageKey),
      publicUrl: null,
      maxAllowedSizeBytes: input.sizeBytes,
    };
  }

  async confirmUpload(
    input: ConfirmUploadInput,
  ): Promise<ConfirmUploadResult> {
    const finalStorageKey = input.storageKey.startsWith('pending/')
      ? input.storageKey.replace(/^pending\//, 'uploaded/')
      : input.storageKey;

    return {
      provider: 'MOCK_STORAGE',
      storageKey: finalStorageKey,
      confirmed: true,
      confirmedAt: new Date().toISOString(),

      uploadStatus: 'UPLOADED',
      providerUploadId: this.buildProviderUploadId(finalStorageKey),
      objectUrl: this.buildObjectUrl(finalStorageKey),
      publicUrl: null,
      checksum: null,
    };
  }
}