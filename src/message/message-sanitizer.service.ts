import { Injectable } from '@nestjs/common';

@Injectable()
export class MessageSanitizerService {
  sanitize(content: string): { content: string; isRedacted: boolean } {
    let sanitized = (content ?? '').trim();
    let isRedacted = false;

    const rules: Array<{ regex: RegExp; replacement: string }> = [
      {
        regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        replacement: '[email redacted]',
      },
      {
        regex: /\b(?:https?:\/\/|www\.)\S+\b/gi,
        replacement: '[link redacted]',
      },
      {
        regex: /\b(?:wa\.me\/\S+|chat\.whatsapp\.com\/\S+)\b/gi,
        replacement: '[whatsapp redacted]',
      },
      {
        regex: /\b(?:whatsapp|telegram|signal|imo|instagram|facebook|snapchat|tiktok)\b/gi,
        replacement: '[external contact redacted]',
      },
      {
        regex: /(?:\+?\d[\d\s().-]{6,}\d)/g,
        replacement: '[phone redacted]',
      },
    ];

    for (const rule of rules) {
      if (rule.regex.test(sanitized)) {
        isRedacted = true;
        sanitized = sanitized.replace(rule.regex, rule.replacement);
      }
    }

    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return {
      content: sanitized,
      isRedacted,
    };
  }
}