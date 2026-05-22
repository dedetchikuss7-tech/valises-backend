import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentIntentContext,
  PaymentIntentResult,
  PaymentProviderAdapter,
} from '../payment.provider';

const CINETPAY_API_URL = 'https://api-checkout.cinetpay.com/v2/payment';

@Injectable()
export class CinetPayProvider implements PaymentProviderAdapter {
  private readonly logger = new Logger(CinetPayProvider.name);
  private readonly apiKey: string;
  private readonly siteId: string;
  private readonly notifyUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.getOrThrow<string>('CINETPAY_API_KEY');
    this.siteId = this.config.getOrThrow<string>('CINETPAY_SITE_ID');
    this.notifyUrl = this.config.getOrThrow<string>('CINETPAY_NOTIFY_URL');
  }

  async createPaymentIntent(
    context: PaymentIntentContext,
  ): Promise<PaymentIntentResult> {
    const payload = {
      apikey: this.apiKey,
      site_id: this.siteId,
      transaction_id: context.transactionId,
      amount: context.amount,
      currency: context.currency,
      description:
        context.description ?? `Payment for transaction ${context.transactionId}`,
      notify_url: this.notifyUrl,
      return_url: context.returnUrl ?? this.notifyUrl,
    };

    let data: any;

    try {
      const response = await fetch(CINETPAY_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      data = await response.json();
    } catch (err) {
      this.logger.error('CinetPay network error', err);
      throw new BadGatewayException('CinetPay is unreachable');
    }

    if (data.code !== '201') {
      this.logger.error('CinetPay rejected payment intent', data);
      throw new BadGatewayException(
        `CinetPay error: ${data.message ?? 'Unknown error'}`,
      );
    }

    return {
      checkoutUrl: data.data.payment_url,
      paymentIntentId: context.transactionId,
      provider: 'CINETPAY',
      expiresAt: null,
      metadata: {
        code: data.code,
        message: data.message,
        paymentToken: data.data.payment_token,
      },
    };
  }
}
