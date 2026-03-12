import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AbandonmentController } from './abandonment.controller';
import { AbandonmentService } from './abandonment.service';

@Module({
  imports: [PrismaModule],
  controllers: [AbandonmentController],
  providers: [AbandonmentService],
  exports: [AbandonmentService],
})
export class AbandonmentModule {}