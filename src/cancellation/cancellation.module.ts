import { Module } from '@nestjs/common';
import { CancellationUserController, CancellationAdminController } from './cancellation.controller';
import { CancellationService } from './cancellation.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CancellationUserController, CancellationAdminController],
  providers: [CancellationService],
  exports: [CancellationService],
})
export class CancellationModule {}
