import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';
import { DisputeMatrixService } from './dispute-matrix.service';

@Module({
  imports: [PrismaModule, LedgerModule],
  controllers: [DisputeController],
  providers: [DisputeService, DisputeMatrixService],
})
export class DisputeModule {}