import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminFinancialControlsController } from './admin-financial-controls.controller';
import { AdminFinancialControlsService } from './admin-financial-controls.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminFinancialControlsController],
  providers: [AdminFinancialControlsService],
  exports: [AdminFinancialControlsService],
})
export class AdminFinancialControlsModule {}