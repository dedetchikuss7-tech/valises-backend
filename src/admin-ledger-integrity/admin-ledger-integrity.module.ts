import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AdminLedgerIntegrityController } from './admin-ledger-integrity.controller';
import { AdminLedgerIntegrityService } from './admin-ledger-integrity.service';

@Module({
  imports: [PrismaModule, LedgerModule],
  controllers: [AdminLedgerIntegrityController],
  providers: [AdminLedgerIntegrityService],
})
export class AdminLedgerIntegrityModule {}