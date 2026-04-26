import { Module } from '@nestjs/common';
import { MockStorageProvider } from './mock-storage.provider';
import {
  STORAGE_PROVIDER,
  StorageProvider,
  StorageProviderName,
} from './storage.provider';
import {
  resolveStorageProviderName,
  STORAGE_PROVIDER_ENV_KEY,
} from './storage.config';

@Module({
  providers: [
    MockStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useFactory: (mockStorageProvider: MockStorageProvider): StorageProvider => {
        const providerName = resolveStorageProviderName(
          process.env[STORAGE_PROVIDER_ENV_KEY],
        );

        switch (providerName) {
          case StorageProviderName.MOCK_STORAGE:
            return mockStorageProvider;

          case StorageProviderName.S3:
          case StorageProviderName.CLOUDINARY:
          case StorageProviderName.SUPABASE:
          case StorageProviderName.MANUAL:
          default:
            throw new Error(
              `${STORAGE_PROVIDER_ENV_KEY}=${providerName} is not implemented yet`,
            );
        }
      },
      inject: [MockStorageProvider],
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}