import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyRateService } from './currency-rate.service';
import { ConfigService } from '@nestjs/config';

const mockConfig = { get: jest.fn() };

describe('CurrencyRateService', () => {
  let service: CurrencyRateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrencyRateService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<CurrencyRateService>(CurrencyRateService);
    jest.clearAllMocks();
  });

  it('returns indicative: true always', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const rates = await service.getRates();
    expect(rates.indicative).toBe(true);
    expect(rates.XAF_EUR).toBeGreaterThan(0);
    expect(rates.XAF_USD).toBeGreaterThan(0);
  });

  it('returns cached rates on second call', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { EUR: 0.00153, USD: 0.00165 } }),
    });

    const rates1 = await service.getRates();
    const rates2 = await service.getRates();

    expect(global.fetch).toHaveBeenCalledTimes(1); // cached second time
    expect(rates1).toBe(rates2); // same object reference
  });

  it('falls back gracefully when fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Timeout'));

    const rates = await service.getRates();
    expect(rates.XAF_EUR).toBe(0.001524);
    expect(rates.XAF_USD).toBe(0.001649);
    expect(rates.indicative).toBe(true);
  });

  it('converts XAF to EUR correctly', () => {
    const rates = {
      XAF_EUR: 0.001524,
      XAF_USD: 0.001649,
      fetchedAt: new Date().toISOString(),
      indicative: true as const,
      ttlSeconds: 3600,
    };

    const eur = service.convertFromXaf(100000, 'EUR', rates);
    expect(eur).toBe(152.4);
  });

  it('converts XAF to USD correctly', () => {
    const rates = {
      XAF_EUR: 0.001524,
      XAF_USD: 0.001649,
      fetchedAt: new Date().toISOString(),
      indicative: true as const,
      ttlSeconds: 3600,
    };

    const usd = service.convertFromXaf(50000, 'USD', rates);
    expect(usd).toBe(82.45);
  });
});
