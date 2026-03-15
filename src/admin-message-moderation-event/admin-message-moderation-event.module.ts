import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminMessageModerationEventController } from './admin-message-moderation-event.controller';
import { AdminMessageModerationEventService } from './admin-message-moderation-event.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminMessageModerationEventController],
  providers: [AdminMessageModerationEventService],
})
export class AdminMessageModerationEventModule {}