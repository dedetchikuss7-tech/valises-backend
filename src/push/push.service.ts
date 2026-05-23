import { Injectable, Logger } from '@nestjs/common';

interface PushProvider {
  send(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void>;
}

class MockPushProvider implements PushProvider {
  private readonly logger = new Logger(MockPushProvider.name);

  async send(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log(
      `[MOCK PUSH] userId=${userId} title="${title}" body="${body}" data=${JSON.stringify(data ?? {})}`,
    );
  }
}

@Injectable()
export class PushService {
  private readonly provider: PushProvider = new MockPushProvider();

  async notifyPaymentConfirmed(
    userId: string,
    transactionId: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    await this.provider.send(
      userId,
      'Payment confirmed',
      `Your payment of ${amount} ${currency} has been confirmed.`,
      { transactionId, amount, currency },
    );
  }

  async notifyDeliveryConfirmed(
    userId: string,
    transactionId: string,
  ): Promise<void> {
    await this.provider.send(
      userId,
      'Delivery confirmed',
      'Your delivery has been confirmed successfully.',
      { transactionId },
    );
  }

  async notifyDisputeOpened(
    userId: string,
    transactionId: string,
  ): Promise<void> {
    await this.provider.send(
      userId,
      'Dispute opened',
      'A dispute has been opened for your transaction.',
      { transactionId },
    );
  }
}
