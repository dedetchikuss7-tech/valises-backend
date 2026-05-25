import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CinetPayProvider } from '../payment/providers/cinetpay.provider';
import { AdminReconciliationController } from './admin-reconciliation.controller';
import { AdminReconciliationService } from './admin-reconciliation.service';
import { PspReconciliationService } from './psp-reconciliation.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminReconciliationController],
  providers: [AdminReconciliationService, PspReconciliationService, CinetPayProvider],
  exports: [AdminReconciliationService, PspReconciliationService],
})
export class AdminReconciliationModule {}