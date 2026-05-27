export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  unsubscribeToken?: string;
}

export interface EmailProvider {
  sendEmail(options: SendEmailOptions): Promise<void>;
}

export const EMAIL_PROVIDER_TOKEN = 'EMAIL_PROVIDER';
