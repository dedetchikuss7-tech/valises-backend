import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminOwnershipModule } from '../admin-ownership/admin-ownership.module';
import { AdminWorkloadController } from './admin-workload.controller';
import { AdminWorkloadService } from './admin-workload.service';

@Module({
  imports: [PrismaModule, AdminOwnershipModule],
  controllers: [AdminWorkloadController],
  providers: [AdminWorkloadService],
  exports: [AdminWorkloadService],
})
export class AdminWorkloadModule {}