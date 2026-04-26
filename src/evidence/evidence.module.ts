import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminActionAuditModule } from '../admin-action-audit/admin-action-audit.module';
import { AdminTimelineModule } from '../admin-timeline/admin-timeline.module';
import { EvidenceController } from './evidence.controller';
import { EvidenceAdminController } from './evidence-admin.controller';
import { EvidenceService } from './evidence.service';

@Module({
  imports: [PrismaModule, AdminActionAuditModule, AdminTimelineModule],
  controllers: [EvidenceController, EvidenceAdminController],
  providers: [EvidenceService],
  exports: [EvidenceService],
})
export class EvidenceModule {}