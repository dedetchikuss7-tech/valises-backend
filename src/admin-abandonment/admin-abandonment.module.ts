import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAbandonmentController } from './admin-abandonment.controller';
import { AdminAbandonmentService } from './admin-abandonment.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminAbandonmentController],
  providers: [AdminAbandonmentService],
  exports: [AdminAbandonmentService],
})
export class AdminAbandonmentModule {}