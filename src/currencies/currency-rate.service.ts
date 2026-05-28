import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CurrencyRates {
  XAF_EUR: number;
  XAF_USD: number;
  fetchedAt: string;
  indicative: true;
  ttlSeconds: number;
}

interface CacheEntry {
  rates: CurrencyRates;
  expiresAt: number;
}

const TTL_MS = 60 * 60 * 1000; // 1 hour
const FALLBACK_RATES = { XAF_EUR: 0.001524, XAF_USD: 0.001649 }; // ~655 XAF/EUR, ~607 XAF/USD

@Injectable()
export class CurrencyRateService {
  private readonly logger = new Logger(CurrencyRateService.name);
  private cache: CacheEntry | null = null;

  constructor(private readonly config: ConfigService) {}

  async getRates(): Promise<CurrencyRates> {
    const now = Date.now();

    if (this.cache && now < this.cache.expiresAt) {
      return this.cache.rates;
    }

    const rates = await this.fetchRatesWithFallback();
    this.cache = { rates, expiresAt: now + TTL_MS };
    return rates;
  }

  private async fetchRatesWithFallback(): Promise<CurrencyRates> {
    try {
      const response = await fetch(
        'https://open.er-api.com/v6/latest/XAF',
        { signal: AbortSignal.timeout(3000) },
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as any;

      const XAF_EUR = data?.rates?.EUR ?? FALLBACK_RATES.XAF_EUR;
      const XAF_USD = data?.rates?.USD ?? FALLBACK_RATES.XAF_USD;

      return {
        XAF_EUR,
        XAF_USD,
        fetchedAt: new Date().toISOString(),
        indicative: true,
        ttlSeconds: 3600,
      };
    } catch (err: any) {
      this.logger.warn(`Currency rate fetch failed, using fallback: ${err.message}`);
      return {
        ...FALLBACK_RATES,
        fetchedAt: new Date().toISOString(),
        indicative: true,
        ttlSeconds: 3600,
      };
    }
  }

  convertFromXaf(
    amountXaf: number,
    currency: 'EUR' | 'USD',
    rates: CurrencyRates,
  ): number {
    const rate = currency === 'EUR' ? rates.XAF_EUR : rates.XAF_USD;
    return Math.round(amountXaf * rate * 100) / 100; // round to 2 decimals
  }
}
