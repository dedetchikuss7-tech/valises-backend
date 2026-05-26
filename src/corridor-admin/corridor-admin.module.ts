import { Module } from '@nestjs/common';
import { CorridorAdminController } from './corridor-admin.controller';
import { CorridorAdminService } from './corridor-admin.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CorridorAdminController],
  providers: [CorridorAdminService],
})
export class CorridorAdminModule {}
