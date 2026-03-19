import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminActionAuditController } from './admin-action-audit.controller';
import { AdminActionAuditService } from './admin-action-audit.service';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AdminActionAuditController],
  providers: [AdminActionAuditService],
  exports: [AdminActionAuditService],
})
export class AdminActionAuditModule {}