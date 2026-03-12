import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AbandonmentModule } from '../abandonment/abandonment.module';
import { PackageController } from './package.controller';
import { PackageService } from './package.service';

@Module({
  imports: [PrismaModule, AbandonmentModule],
  controllers: [PackageController],
  providers: [PackageService],
  exports: [PackageService],
})
export class PackageModule {}