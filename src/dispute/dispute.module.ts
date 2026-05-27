import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PayoutModule } from '../payout/payout.module';
import { RefundModule } from '../refund/refund.module';
import { StorageModule } from '../storage/storage.module';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';
import { DisputeMatrixService } from './dispute-matrix.service';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

@Module({
  imports: [
    PrismaModule,
    LedgerModule,
    PayoutModule,
    RefundModule,
    StorageModule,
  ],
  controllers: [DisputeController, EvidenceController],
  providers: [DisputeService, DisputeMatrixService, EvidenceService],
  exports: [DisputeService],
})
export class DisputeModule {}