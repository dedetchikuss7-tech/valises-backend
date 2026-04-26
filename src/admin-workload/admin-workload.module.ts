import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminOwnershipModule } from '../admin-ownership/admin-ownership.module';
import { AdminWorkloadController } from './admin-workload.controller';
import { AdminWorkloadService } from './admin-workload.service';
import { AdminWorkloadDrilldownService } from './admin-workload-drilldown.service';

@Module({
  imports: [PrismaModule, AdminOwnershipModule],
  controllers: [AdminWorkloadController],
  providers: [AdminWorkloadService, AdminWorkloadDrilldownService],
  exports: [AdminWorkloadService, AdminWorkloadDrilldownService],
})
export class AdminWorkloadModule {}