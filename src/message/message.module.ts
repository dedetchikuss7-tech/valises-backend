import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TransactionModule } from '../transaction/transaction.module';
import { EnforcementModule } from '../enforcement/enforcement.module';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { MessageSanitizerService } from './message-sanitizer.service';

@Module({
  imports: [PrismaModule, TransactionModule, EnforcementModule],
  controllers: [MessageController],
  providers: [MessageService, MessageSanitizerService],
  exports: [MessageService],
})
export class MessageModule {}
