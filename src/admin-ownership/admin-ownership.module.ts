import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminActionAuditModule } from '../admin-action-audit/admin-action-audit.module';
import { AdminOwnershipController } from './admin-ownership.controller';
import { AdminOwnershipService } from './admin-ownership.service';

@Module({
  imports: [PrismaModule, AdminActionAuditModule],
  controllers: [AdminOwnershipController],
  providers: [AdminOwnershipService],
  exports: [AdminOwnershipService],
})
export class AdminOwnershipModule {}