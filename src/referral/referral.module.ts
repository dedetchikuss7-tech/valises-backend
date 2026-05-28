import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';
import { ReferralRewardService } from './referral-reward.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReferralController],
  providers: [ReferralService, ReferralRewardService],
  exports: [ReferralService, ReferralRewardService],
})
export class ReferralModule {}
