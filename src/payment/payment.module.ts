import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentIntentService } from './payment-intent.service';
import { PaymentAttemptService } from './payment-attempt.service';
import { PaymentAttemptController } from './payment-attempt.controller';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { CinetPayProvider } from './providers/cinetpay.provider';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentAttemptController],
  providers: [PaymentIntentService, PaymentAttemptService, MockPaymentProvider, CinetPayProvider],
  exports: [PaymentIntentService, PaymentAttemptService],
})
export class PaymentModule {}
