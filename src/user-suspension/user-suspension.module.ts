import { Module } from '@nestjs/common';
import { UserSuspensionController } from './user-suspension.controller';
import { UserSuspensionService } from './user-suspension.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UserSuspensionController],
  providers: [UserSuspensionService],
  exports: [UserSuspensionService],
})
export class UserSuspensionModule {}
