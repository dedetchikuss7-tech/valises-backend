import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { slowQueryLog } from '../operational-health/slow-query-log';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [{ emit: 'event', level: 'query' }],
    });
  }

  async onModuleInit() {
    // PERF: capture queries >500ms — stored in-memory for GET /admin/operational-health/performance/slow-queries
    (this as any).$on('query', (e: any) => {
      if (e.duration > 500) {
        this.logger.warn(`[SLOW QUERY] ${e.duration}ms — ${String(e.query ?? '').slice(0, 120)}`);
        const firstWord = String(e.query ?? '').trim().split(/\s+/)[0]?.toUpperCase() ?? 'QUERY';
        const tableMatch = String(e.query ?? '').match(/(?:FROM|INTO|UPDATE|JOIN)\s+"[^"]*"\."([^"]+)"/i);
        slowQueryLog.push({
          model: tableMatch?.[1] ?? 'unknown',
          action: firstWord,
          duration: e.duration,
          timestamp: new Date().toISOString(),
        });
        if (slowQueryLog.length > 100) slowQueryLog.shift();
      }
    });
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
