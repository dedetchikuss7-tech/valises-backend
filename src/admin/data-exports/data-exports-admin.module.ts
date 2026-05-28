import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DataExportsAdminController } from './data-exports-admin.controller';

@Module({
  imports: [PrismaModule],
  controllers: [DataExportsAdminController],
})
export class DataExportsAdminModule {}
