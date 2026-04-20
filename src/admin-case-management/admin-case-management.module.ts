import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminCaseManagementController } from './admin-case-management.controller';
import { AdminCaseManagementService } from './admin-case-management.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminCaseManagementController],
  providers: [AdminCaseManagementService],
  exports: [AdminCaseManagementService],
})
export class AdminCaseManagementModule {}