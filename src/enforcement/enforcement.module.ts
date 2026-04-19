import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AmlModule } from '../aml/aml.module';
import { EnforcementService } from './enforcement.service';

@Module({
  imports: [PrismaModule, AmlModule],
  providers: [EnforcementService],
  exports: [EnforcementService],
})
export class EnforcementModule {}