import { Module } from '@nestjs/common';
import { CorridorAdminController } from './corridor-admin.controller';
import { CorridorAdminService } from './corridor-admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CorridorsModule } from '../corridors/corridors.module';

@Module({
  imports: [PrismaModule, CorridorsModule],
  controllers: [CorridorAdminController],
  providers: [CorridorAdminService],
})
export class CorridorAdminModule {}
