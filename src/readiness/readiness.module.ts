import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReadinessController } from './readiness.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ReadinessController],
})
export class ReadinessModule {}