import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class CorridorCacheService {
  private readonly logger = new Logger(CorridorCacheService.name);
  private readonly store = new Map<string, CacheEntry<any>>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  invalidate(key: string): void {
    this.store.delete(key);
    this.logger.debug(`Cache invalidated: ${key}`);
  }

  invalidateAll(): void {
    this.store.clear();
    this.logger.debug('Cache cleared');
  }
}
