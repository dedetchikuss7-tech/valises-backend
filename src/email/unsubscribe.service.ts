import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

@Injectable()
export class UnsubscribeService {
  private readonly secret: string;

  constructor(private readonly config: ConfigService) {
    this.secret =
      this.config.get<string>('EMAIL_UNSUBSCRIBE_SECRET') ??
      'dev-secret-not-for-production-replace-me';
  }

  generateToken(userId: string): string {
    return createHmac('sha256', this.secret).update(userId).digest('hex');
  }

  verifyToken(userId: string, token: string): boolean {
    const expected = this.generateToken(userId);
    if (expected.length !== token.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
    }
    return diff === 0;
  }
}
