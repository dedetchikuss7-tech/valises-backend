import { Module } from '@nestjs/common';
import { FinancialAuditController } from './financial-audit.controller';
import { FinancialAuditService } from './financial-audit.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FinancialAuditController],
  providers: [FinancialAuditService],
})
export class FinancialAuditModule {}
