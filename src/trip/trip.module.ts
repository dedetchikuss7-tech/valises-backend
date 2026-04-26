import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AbandonmentModule } from '../abandonment/abandonment.module';
import { StorageModule } from '../storage/storage.module';
import { TripController } from './trip.controller';
import { TripService } from './trip.service';

@Module({
  imports: [PrismaModule, AbandonmentModule, StorageModule],
  controllers: [TripController],
  providers: [TripService],
  exports: [TripService],
})
export class TripModule {}