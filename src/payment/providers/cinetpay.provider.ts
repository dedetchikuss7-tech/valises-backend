import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentIntentContext,
  PaymentIntentResult,
  PaymentProviderAdapter,
} from '../payment.provider';

export type CinetPayVerifyResult = {
  found: boolean;
  pspStatus: string | null;
  pspAmount: number | null;
  currency: string | null;
  rawResponse: Record<string, unknown>;
};

const CINETPAY_API_URLS: Record<string, string> = {
  sandbox: 'https://api-checkout.cinetpay.com/v2/payment',
  production: 'https://api-checkout.cinetpay.com/v2/payment',
};

@Injectable()
export class CinetPayProvider implements PaymentProviderAdapter {
  private readonly logger = new Logger(CinetPayProvider.name);
  private readonly apiKey: string;
  private readonly siteId: string;
  private readonly notifyUrl: string;
  private readonly returnUrl: string | undefined;
  private readonly apiUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.getOrThrow<string>('CINETPAY_API_KEY');
    this.siteId = this.config.getOrThrow<string>('CINETPAY_SITE_ID');
    this.notifyUrl = this.config.getOrThrow<string>('CINETPAY_NOTIFY_URL');
    this.returnUrl = this.config.get<string>('CINETPAY_RETURN_URL');
    const env = this.config.get<string>('CINETPAY_ENV', 'sandbox');
    this.apiUrl = CINETPAY_API_URLS[env] ?? CINETPAY_API_URLS['sandbox'];
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
      return_url: context.returnUrl ?? this.returnUrl ?? this.notifyUrl,
    };

    let data: any;

    try {
      const response = await fetch(this.apiUrl, {
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

  async verifyTransaction(transactionId: string): Promise<CinetPayVerifyResult> {
    const payload = {
      apikey: this.apiKey,
      site_id: this.siteId,
      transaction_id: transactionId,
    };

    let data: any;

    try {
      const response = await fetch(`${this.apiUrl}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      data = await response.json();
    } catch (err) {
      this.logger.error('CinetPay verifyTransaction network error', err);
      throw new BadGatewayException('CinetPay is unreachable during verification');
    }

    // CinetPay returns code "00" on success; "739" or similar when transaction not found
    if (data.code === '739' || data.code === '601') {
      return { found: false, pspStatus: null, pspAmount: null, currency: null, rawResponse: data };
    }

    if (data.code !== '00') {
      this.logger.warn('CinetPay verifyTransaction unexpected code', data);
      return { found: false, pspStatus: null, pspAmount: null, currency: null, rawResponse: data };
    }

    const d = data.data ?? {};
    return {
      found: true,
      pspStatus: d.status ?? null,
      pspAmount: d.amount != null ? Number(d.amount) : null,
      currency: d.currency ?? null,
      rawResponse: data,
    };
  }
}
