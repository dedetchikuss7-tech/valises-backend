import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminActionAuditModule } from '../admin-action-audit/admin-action-audit.module';
import { AdminTimelineModule } from '../admin-timeline/admin-timeline.module';
import { StorageModule } from '../storage/storage.module';
import { EvidenceController } from './evidence.controller';
import { EvidenceAdminController } from './evidence-admin.controller';
import { EvidenceUploadIntentController } from './evidence-upload-intent.controller';
import { EvidenceUploadConfirmationController } from './evidence-upload-confirmation.controller';
import { EvidenceService } from './evidence.service';
import { EvidenceUploadIntentService } from './evidence-upload-intent.service';
import { EvidenceUploadConfirmationService } from './evidence-upload-confirmation.service';

@Module({
  imports: [
    PrismaModule,
    AdminActionAuditModule,
    AdminTimelineModule,
    StorageModule,
  ],
  controllers: [
    EvidenceController,
    EvidenceAdminController,
    EvidenceUploadIntentController,
    EvidenceUploadConfirmationController,
  ],
  providers: [
    EvidenceService,
    EvidenceUploadIntentService,
    EvidenceUploadConfirmationService,
  ],
  exports: [
    EvidenceService,
    EvidenceUploadIntentService,
    EvidenceUploadConfirmationService,
  ],
})
export class EvidenceModule {}