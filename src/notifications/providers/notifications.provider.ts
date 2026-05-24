export const NOTIFICATIONS_PROVIDER = 'NOTIFICATIONS_PROVIDER';

export interface NotificationsProvider {
  sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
}

export interface SendEmailInput {
  recipientEmail: string;
  subject: string;
  textContent: string;
  htmlContent?: string;
  templateKey: string;
  metadata?: Record<string, unknown>;
}

export interface SendEmailResult {
  success: boolean;
  providerMessageId: string | null;
  sentAt: string;
  error?: string;
}
