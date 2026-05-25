import { Module } from '@nestjs/common';
import { CompensationService } from './compensation.service';
import { CompensationController } from './compensation.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CompensationService],
  controllers: [CompensationController],
  exports: [CompensationService],
})
export class CompensationModule {}
