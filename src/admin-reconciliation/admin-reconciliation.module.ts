import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminReconciliationController } from './admin-reconciliation.controller';
import { AdminReconciliationService } from './admin-reconciliation.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminReconciliationController],
  providers: [AdminReconciliationService],
  exports: [AdminReconciliationService],
})
export class AdminReconciliationModule {}