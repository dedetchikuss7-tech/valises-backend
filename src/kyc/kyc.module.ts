import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AbandonmentModule } from '../abandonment/abandonment.module';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { KycProviderModule } from './kyc-provider.module';
import { KycRetryController, KycAdminController } from './kyc-retry.controller';
import { KycRetryService } from './kyc-retry.service';

@Module({
  imports: [PrismaModule, AbandonmentModule, KycProviderModule],
  controllers: [KycController, KycRetryController, KycAdminController],
  providers: [KycService, KycRetryService],
  exports: [KycService, KycRetryService],
})
export class KycModule {}
