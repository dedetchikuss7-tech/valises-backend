import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentProviderAdapter } from './payment.provider';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { CinetPayProvider } from './providers/cinetpay.provider';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { PaymentIntentResponseDto } from './dto/payment-intent-response.dto';

@Injectable()
export class PaymentIntentService {
  private readonly adapter: PaymentProviderAdapter;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    mock: MockPaymentProvider,
    cinetpay: CinetPayProvider,
  ) {
    const provider = config.get<string>('PAYMENT_PROVIDER', 'MOCK').toUpperCase();
    this.adapter = provider === 'CINETPAY' ? cinetpay : mock;
  }

  async createPaymentIntent(
    transactionId: string,
    dto: CreatePaymentIntentDto,
  ): Promise<PaymentIntentResponseDto> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    const result = await this.adapter.createPaymentIntent({
      transactionId: tx.id,
      amount: tx.amount,
      currency: tx.currency,
      description: dto.description,
      returnUrl: dto.returnUrl,
    });

    return {
      transactionId: tx.id,
      checkoutUrl: result.checkoutUrl,
      paymentIntentId: result.paymentIntentId,
      provider: result.provider,
      expiresAt: result.expiresAt,
    };
  }
}
