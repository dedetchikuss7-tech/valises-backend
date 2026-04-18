import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AmlController } from './aml.controller';
import { AmlService } from './aml.service';

@Module({
  imports: [PrismaModule],
  controllers: [AmlController],
  providers: [AmlService],
  exports: [AmlService],
})
export class AmlModule {}