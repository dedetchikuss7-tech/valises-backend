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
  async prepareUpload(
    input: PrepareUploadInput,
  ): Promise<PrepareUploadResult> {
    const encodedStorageKey = encodeURIComponent(input.storageKey);

    return {
      provider: 'MOCK_STORAGE',
      storageKey: input.storageKey,
      uploadUrl: `https://mock-storage.local/upload/${encodedStorageKey}?token=abc`,
      method: 'PUT',
      headers: {
        'content-type': input.mimeType,
        'x-mock-upload-token': 'abc',
      },
      expiresInSeconds: 900,
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
    };
  }
}