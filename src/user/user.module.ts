import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { SenderSummaryService } from './sender-summary.service';
import { DataExportService } from './data-export.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [UserService, SenderSummaryService, DataExportService],
  exports: [UserService],
})
export class UserModule {}
