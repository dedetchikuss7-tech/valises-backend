export interface SendPushOptions {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushProvider {
  sendPush(options: SendPushOptions): Promise<PushResult>;
}

export interface PushResult {
  success: boolean;
  unregistered?: boolean;
  error?: string;
}

export const PUSH_PROVIDER_TOKEN = 'PUSH_PROVIDER';
