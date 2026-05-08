import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminTransactionOperationsController } from './admin-transaction-operations.controller';
import { AdminTransactionOperationsService } from './admin-transaction-operations.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminTransactionOperationsController],
  providers: [AdminTransactionOperationsService],
  exports: [AdminTransactionOperationsService],
})
export class AdminTransactionOperationsModule {}