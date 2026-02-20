import { Module } from '@nestjs/common';
import { DisputeService } from './dispute.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [DisputeService],
  exports: [DisputeService],
})
export class DisputeModule {}
