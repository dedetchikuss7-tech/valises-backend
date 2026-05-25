import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TrustController } from './trust.controller';
import { TrustService } from './trust.service';
import { TrustLevelController } from './trust-level.controller';
import { TrustLevelService } from './trust-level.service';

@Module({
  imports: [PrismaModule],
  controllers: [TrustController, TrustLevelController],
  providers: [TrustService, TrustLevelService],
  exports: [TrustService, TrustLevelService],
})
export class TrustModule {}