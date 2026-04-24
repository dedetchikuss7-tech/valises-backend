import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminTimelineController } from './admin-timeline.controller';
import { AdminTimelineService } from './admin-timeline.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminTimelineController],
  providers: [AdminTimelineService],
  exports: [AdminTimelineService],
})
export class AdminTimelineModule {}