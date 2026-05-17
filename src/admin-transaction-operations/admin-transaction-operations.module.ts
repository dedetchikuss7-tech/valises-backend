import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminTransactionOperationsController } from './admin-transaction-operations.controller';
import { AdminTransactionOperationsService } from './admin-transaction-operations.service';
import { AdminTransactionOperationalPlaybooksController } from './admin-transaction-operational-playbooks.controller';
import { AdminTransactionOperationalPlaybooksService } from './admin-transaction-operational-playbooks.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    AdminTransactionOperationsController,
    AdminTransactionOperationalPlaybooksController,
  ],
  providers: [
    AdminTransactionOperationsService,
    AdminTransactionOperationalPlaybooksService,
  ],
  exports: [
    AdminTransactionOperationsService,
    AdminTransactionOperationalPlaybooksService,
  ],
})
export class AdminTransactionOperationsModule {}