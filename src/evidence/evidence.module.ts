import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EvidenceController } from './evidence.controller';
import { EvidenceAdminController } from './evidence-admin.controller';
import { EvidenceService } from './evidence.service';

@Module({
  imports: [PrismaModule],
  controllers: [EvidenceController, EvidenceAdminController],
  providers: [EvidenceService],
  exports: [EvidenceService],
})
export class EvidenceModule {}