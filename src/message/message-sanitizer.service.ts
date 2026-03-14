import { Injectable } from '@nestjs/common';

export type MessageModerationStatus = 'CLEAN' | 'SANITIZED' | 'BLOCKED';

export type MessageSanitizationResult = {
  content: string;
  isRedacted: boolean;
  status: MessageModerationStatus;
  reasons: string[];
};

@Injectable()
export class MessageSanitizerService {
  sanitize(content: string): MessageSanitizationResult {
    const original = (content ?? '').trim();

    if (!original) {
      return {
        content: '',
        isRedacted: false,
        status: 'BLOCKED',
        reasons: ['empty_message'],
      };
    }

    let sanitized = original;
    let isRedacted = false;
    const reasons = new Set<string>();

    const rules: Array<{ key: string; regex: RegExp; replacement: string }> = [
      {
        key: 'email',
        regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        replacement: '[email redacted]',
      },
      {
        key: 'url',
        regex: /\b(?:https?:\/\/|www\.)\S+\b/gi,
        replacement: '[link redacted]',
      },
      {
        key: 'whatsapp_link',
        regex: /\b(?:wa\.me\/\S+|chat\.whatsapp\.com\/\S+)\b/gi,
        replacement: '[whatsapp redacted]',
      },
      {
        key: 'external_app',
        regex: /\b(?:whatsapp|telegram|signal|imo|instagram|facebook|snapchat|tiktok)\b/gi,
        replacement: '[external contact redacted]',
      },
      {
        key: 'social_handle',
        regex: /(^|\s)@[a-z0-9._-]{3,}\b/gi,
        replacement: ' [external contact redacted]',
      },
      {
        key: 'phone',
        regex: /(?:\+?\d[\d\s().-]{6,}\d)/g,
        replacement: '[phone redacted]',
      },
    ];

    for (const rule of rules) {
      const matches = sanitized.match(rule.regex);
      if (matches && matches.length > 0) {
        isRedacted = true;
        reasons.add(rule.key);
        sanitized = sanitized.replace(rule.regex, rule.replacement);
      }
    }

    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    const contactIntentDetected =
      /\b(?:whatsapp|telegram|signal|imo|instagram|facebook|snapchat|tiktok|wa\.me|chat\.whatsapp\.com|appelle[\s-]*moi|appele[\s-]*moi|contacte[\s-]*moi|écris[\s-]*moi|ecris[\s-]*moi|joins?[\s-]*moi|num(?:é|e)ro|mail|email|gmail)\b/i.test(
        original.toLowerCase(),
      ) || /(^|\s)@[a-z0-9._-]{3,}\b/i.test(original);

    const visibleWordCount = this.countVisibleWords(sanitized);
    const redactedTokenCount = this.countRedactedTokens(sanitized);

    if (isRedacted && redactedTokenCount > 0 && visibleWordCount === 0) {
      reasons.add('contact_only_message');
      return {
        content: sanitized,
        isRedacted: true,
        status: 'BLOCKED',
        reasons: Array.from(reasons),
      };
    }

    if (isRedacted && contactIntentDetected && visibleWordCount <= 2) {
      reasons.add('contact_only_message');
      return {
        content: sanitized,
        isRedacted: true,
        status: 'BLOCKED',
        reasons: Array.from(reasons),
      };
    }

    return {
      content: sanitized,
      isRedacted,
      status: isRedacted ? 'SANITIZED' : 'CLEAN',
      reasons: Array.from(reasons),
    };
  }

  private countVisibleWords(content: string): number {
    const withoutPlaceholders = content
      .replace(/\[[^\]]+ redacted\]/gi, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!withoutPlaceholders) {
      return 0;
    }

    return withoutPlaceholders.split(' ').filter(Boolean).length;
  }

  private countRedactedTokens(content: string): number {
    return (content.match(/\[[^\]]+ redacted\]/gi) ?? []).length;
  }
}