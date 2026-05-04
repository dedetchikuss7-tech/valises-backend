import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminFinancialControlsModule } from '../admin-financial-controls/admin-financial-controls.module';
import { AdminFinancialOperationsController } from './admin-financial-operations.controller';
import { AdminFinancialOperationsService } from './admin-financial-operations.service';

@Module({
  imports: [PrismaModule, AdminFinancialControlsModule],
  controllers: [AdminFinancialOperationsController],
  providers: [AdminFinancialOperationsService],
  exports: [AdminFinancialOperationsService],
})
export class AdminFinancialOperationsModule {}