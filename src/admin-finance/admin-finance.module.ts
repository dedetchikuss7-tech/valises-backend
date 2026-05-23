import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminFinanceController } from './admin-finance.controller';
import { AdminFinanceService } from './admin-finance.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminFinanceController],
  providers: [AdminFinanceService],
  exports: [AdminFinanceService],
})
export class AdminFinanceModule {}
