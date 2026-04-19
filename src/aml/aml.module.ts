import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TrustModule } from '../trust/trust.module';
import { AmlController } from './aml.controller';
import { AmlService } from './aml.service';

@Module({
  imports: [PrismaModule, TrustModule],
  controllers: [AmlController],
  providers: [AmlService],
  exports: [AmlService],
})
export class AmlModule {}