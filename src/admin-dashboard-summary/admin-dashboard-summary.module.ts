import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminDashboardSummaryController } from './admin-dashboard-summary.controller';
import { AdminDashboardSummaryService } from './admin-dashboard-summary.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminDashboardSummaryController],
  providers: [AdminDashboardSummaryService],
  exports: [AdminDashboardSummaryService],
})
export class AdminDashboardSummaryModule {}