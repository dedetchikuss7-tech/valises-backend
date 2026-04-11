import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PayoutModule } from '../payout/payout.module';
import { RefundModule } from '../refund/refund.module';
import { DisputeModule } from '../dispute/dispute.module';
import { AdminAbandonmentModule } from '../admin-abandonment/admin-abandonment.module';
import { AdminDashboardSummaryController } from './admin-dashboard-summary.controller';
import { AdminDashboardSummaryService } from './admin-dashboard-summary.service';

@Module({
  imports: [
    PrismaModule,
    PayoutModule,
    RefundModule,
    DisputeModule,
    AdminAbandonmentModule,
  ],
  controllers: [AdminDashboardSummaryController],
  providers: [AdminDashboardSummaryService],
  exports: [AdminDashboardSummaryService],
})
export class AdminDashboardSummaryModule {}