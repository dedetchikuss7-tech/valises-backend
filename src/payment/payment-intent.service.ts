import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentProviderAdapter } from './payment.provider';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { CinetPayProvider } from './providers/cinetpay.provider';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { PaymentIntentResponseDto } from './dto/payment-intent-response.dto';
import {
  retryWithBackoff,
  isCinetPayRetryableError,
} from '../common/utils/retry-with-backoff';

@Injectable()
export class PaymentIntentService {
  private readonly logger = new Logger(PaymentIntentService.name);
  private readonly adapter: PaymentProviderAdapter;
  private readonly retryAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly retryMaxDelayMs: number;
  private readonly pspCallTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    mock: MockPaymentProvider,
    cinetpay: CinetPayProvider,
  ) {
    const provider = config.get<string>('PAYMENT_PROVIDER', 'MOCK').toUpperCase();
    this.adapter = provider === 'CINETPAY' ? cinetpay : mock;
    this.retryAttempts = config.get<number>('PSP_RETRY_ATTEMPTS', 3);
    this.retryBaseDelayMs = config.get<number>('PSP_RETRY_BASE_DELAY_MS', 1000);
    this.retryMaxDelayMs = config.get<number>('PSP_RETRY_MAX_DELAY_MS', 10000);
    this.pspCallTimeoutMs = config.get<number>('PSP_CALL_TIMEOUT_MS', 15000);
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

    // CinetPay uses transaction_id as its native idempotency key (see cinetpay.provider.ts),
    // so retries with the same transactionId are deduplicated on the provider side.
    const result = await retryWithBackoff(
      () =>
        this.adapter.createPaymentIntent({
          transactionId: tx.id,
          amount: tx.amount,
          currency: tx.currency,
          description: dto.description,
          returnUrl: dto.returnUrl,
        }),
      {
        attempts: this.retryAttempts,
        baseDelayMs: this.retryBaseDelayMs,
        maxDelayMs: this.retryMaxDelayMs,
        callTimeoutMs: this.pspCallTimeoutMs,
        isRetryable: isCinetPayRetryableError,
        logger: this.logger,
        operationName: `createPaymentIntent:${transactionId}`,
      },
    );

    return {
      transactionId: tx.id,
      checkoutUrl: result.checkoutUrl,
      paymentIntentId: result.paymentIntentId,
      provider: result.provider,
      expiresAt: result.expiresAt,
    };
  }
}
