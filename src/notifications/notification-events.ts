export const NOTIFICATION_EVENTS = {
  TRANSACTION_CREATED: 'TRANSACTION_CREATED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  DELIVERY_CONFIRMED: 'DELIVERY_CONFIRMED',
  DISPUTE_OPENED: 'DISPUTE_OPENED',
  PAYOUT_PAID: 'PAYOUT_PAID',
} as const;

export type NotificationEventType = keyof typeof NOTIFICATION_EVENTS;

export interface NotificationPayload {
  eventType: NotificationEventType;
  entityId: string;
  recipientId: string;
  recipientEmail?: string;
  data?: Record<string, any>;
}
