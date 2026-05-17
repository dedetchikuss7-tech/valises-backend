import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminTransactionOperationsController } from './admin-transaction-operations.controller';
import { AdminTransactionOperationsService } from './admin-transaction-operations.service';
import { AdminTransactionOperationalPlaybooksController } from './admin-transaction-operational-playbooks.controller';
import { AdminTransactionOperationalPlaybooksService } from './admin-transaction-operational-playbooks.service';
import { AdminTransactionOperationalTimelineController } from './admin-transaction-operational-timeline.controller';
import { AdminTransactionOperationalTimelineService } from './admin-transaction-operational-timeline.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    AdminTransactionOperationsController,
    AdminTransactionOperationalPlaybooksController,
    AdminTransactionOperationalTimelineController,
  ],
  providers: [
    AdminTransactionOperationsService,
    AdminTransactionOperationalPlaybooksService,
    AdminTransactionOperationalTimelineService,
  ],
  exports: [
    AdminTransactionOperationsService,
    AdminTransactionOperationalPlaybooksService,
  ],
})
export class AdminTransactionOperationsModule {}