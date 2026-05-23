import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FraudController } from './fraud.controller';
import { FraudService } from './fraud.service';

@Module({
  imports: [PrismaModule],
  controllers: [FraudController],
  providers: [FraudService],
  exports: [FraudService],
})
export class FraudModule {}
