import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentLifecycleController } from './document-lifecycle.controller';
import { DocumentLifecycleScheduler } from './document-lifecycle.scheduler';
import { DocumentLifecycleService } from './document-lifecycle.service';

@Module({
  imports: [PrismaModule],
  providers: [DocumentLifecycleService, DocumentLifecycleScheduler],
  controllers: [DocumentLifecycleController],
  exports: [DocumentLifecycleService],
})
export class DocumentLifecycleModule {}
