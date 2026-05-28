export interface SlowQueryEntry {
  model: string;
  action: string;
  duration: number;
  timestamp: string;
}

// PERF: shared in-memory buffer — singleton, populated by PrismaService query listener
export const slowQueryLog: SlowQueryEntry[] = [];
