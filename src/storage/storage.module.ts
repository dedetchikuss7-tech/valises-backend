import { Module } from '@nestjs/common';
import { MockStorageProvider } from './mock-storage.provider';
import { STORAGE_PROVIDER } from './storage.provider';

@Module({
  providers: [
    MockStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useExisting: MockStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}