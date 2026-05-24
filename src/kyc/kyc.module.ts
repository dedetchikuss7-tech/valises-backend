import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AbandonmentModule } from '../abandonment/abandonment.module';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { KycProviderModule } from './kyc-provider.module';

@Module({
  imports: [PrismaModule, AbandonmentModule, KycProviderModule],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
