import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MobileContractController } from './mobile-contract.controller';
import { MobileContractService } from './mobile-contract.service';

@Module({
  imports: [PrismaModule],
  controllers: [MobileContractController],
  providers: [MobileContractService],
  exports: [MobileContractService],
})
export class MobileContractModule {}