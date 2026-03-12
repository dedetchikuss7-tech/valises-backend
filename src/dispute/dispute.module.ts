import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PayoutModule } from '../payout/payout.module';
import { RefundModule } from '../refund/refund.module';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';
import { DisputeMatrixService } from './dispute-matrix.service';

@Module({
  imports: [PrismaModule, LedgerModule, PayoutModule, RefundModule],
  controllers: [DisputeController],
  providers: [DisputeService, DisputeMatrixService],
  exports: [DisputeService],
})
export class DisputeModule {}