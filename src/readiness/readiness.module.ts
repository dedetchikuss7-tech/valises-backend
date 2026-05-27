import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReadinessController } from './readiness.controller';
import { AdminReadinessController } from './admin-readiness.controller';
import { ReadinessService } from './readiness.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReadinessController, AdminReadinessController],
  providers: [ReadinessService],
})
export class ReadinessModule {}
