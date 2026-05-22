import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentIntentService } from './payment-intent.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { CinetPayProvider } from './providers/cinetpay.provider';

@Module({
  imports: [PrismaModule],
  providers: [PaymentIntentService, MockPaymentProvider, CinetPayProvider],
  exports: [PaymentIntentService],
})
export class PaymentModule {}
