import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PayoutModule } from '../payout/payout.module';
import { RefundModule } from '../refund/refund.module';
import { DisputeModule } from '../dispute/dispute.module';
import { AdminDashboardSummaryController } from './admin-dashboard-summary.controller';
import { AdminDashboardSummaryService } from './admin-dashboard-summary.service';

@Module({
  imports: [PrismaModule, PayoutModule, RefundModule, DisputeModule],
  controllers: [AdminDashboardSummaryController],
  providers: [AdminDashboardSummaryService],
  exports: [AdminDashboardSummaryService],
})
export class AdminDashboardSummaryModule {}