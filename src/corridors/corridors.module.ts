import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CorridorPublicController } from './corridor-public.controller';
import { CorridorPublicService } from './corridor-public.service';
import { CorridorCacheService } from './corridor-cache.service';

@Module({
  imports: [PrismaModule],
  controllers: [CorridorPublicController],
  providers: [CorridorPublicService, CorridorCacheService],
  exports: [CorridorPublicService, CorridorCacheService],
})
export class CorridorsModule {}
