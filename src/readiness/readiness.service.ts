import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CheckStatus = 'OK' | 'FAIL' | 'WARN';

export interface ReadinessCheck {
  name: string;
  status: CheckStatus;
  message: string;
}

export interface ReadinessReport {
  overall: 'READY' | 'NOT_READY';
  checkedAt: string;
  checks: ReadinessCheck[];
}

@Injectable()
export class ReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async getReadinessReport(): Promise<ReadinessReport> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkMigrations(),
      this.checkEnvVars(),
      this.checkCorridorSeeds(),
      this.checkAdminUser(),
      this.checkPaymentProvider(),
      this.checkStorageProvider(),
      this.checkNotificationsFlag(),
    ]);

    const hasFail = checks.some((c) => c.status === 'FAIL');

    return {
      overall: hasFail ? 'NOT_READY' : 'READY',
      checkedAt: new Date().toISOString(),
      checks,
    };
  }

  private async checkDatabase(): Promise<ReadinessCheck> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { name: 'database_connectivity', status: 'OK', message: 'Database is reachable' };
    } catch (e) {
      return { name: 'database_connectivity', status: 'FAIL', message: `Database unreachable: ${(e as Error).message}` };
    }
  }

  private async checkMigrations(): Promise<ReadinessCheck> {
    try {
      const pending = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM "_prisma_migrations"
        WHERE finished_at IS NULL AND rolled_back_at IS NULL
      `;
      const count = Number(pending[0]?.count ?? 0);
      if (count > 0) {
        return { name: 'migrations', status: 'FAIL', message: `${count} pending migration(s) — run prisma migrate deploy` };
      }
      return { name: 'migrations', status: 'OK', message: 'All migrations applied' };
    } catch {
      return { name: 'migrations', status: 'WARN', message: 'Could not verify migration status' };
    }
  }

  private checkEnvVars(): ReadinessCheck {
    const required = [
      'DATABASE_URL',
      'JWT_SECRET',
      'PAYMENT_PROVIDER',
      'STORAGE_PROVIDER',
    ];
    const missing = required.filter((v) => !process.env[v]);

    if (missing.length > 0) {
      return {
        name: 'env_vars',
        status: 'FAIL',
        message: `Missing required env vars: ${missing.join(', ')}`,
      };
    }

    const recommended = ['CINETPAY_API_KEY', 'AWS_S3_BUCKET', 'SENDGRID_API_KEY'];
    const missingRec = recommended.filter((v) => !process.env[v]);
    if (missingRec.length > 0) {
      return {
        name: 'env_vars',
        status: 'WARN',
        message: `Recommended env vars not set: ${missingRec.join(', ')}`,
      };
    }

    return { name: 'env_vars', status: 'OK', message: 'All required env vars present' };
  }

  private async checkCorridorSeeds(): Promise<ReadinessCheck> {
    try {
      const count = await this.prisma.corridor.count();
      if (count === 0) {
        return { name: 'corridor_seeds', status: 'FAIL', message: 'No corridors found — run prisma db seed' };
      }
      return { name: 'corridor_seeds', status: 'OK', message: `${count} corridor(s) seeded` };
    } catch {
      return { name: 'corridor_seeds', status: 'WARN', message: 'Could not verify corridor seeds' };
    }
  }

  private async checkAdminUser(): Promise<ReadinessCheck> {
    try {
      const count = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (count === 0) {
        return { name: 'admin_user', status: 'FAIL', message: 'No admin user found — create one before launch' };
      }
      return { name: 'admin_user', status: 'OK', message: `${count} admin user(s) found` };
    } catch {
      return { name: 'admin_user', status: 'WARN', message: 'Could not verify admin users' };
    }
  }

  private checkPaymentProvider(): ReadinessCheck {
    const provider = process.env.PAYMENT_PROVIDER;
    if (provider === 'MOCK') {
      return { name: 'payment_provider', status: 'WARN', message: 'PAYMENT_PROVIDER is MOCK — switch to CINETPAY before launch' };
    }
    if (provider === 'CINETPAY') {
      const hasKey = !!process.env.CINETPAY_API_KEY && !!process.env.CINETPAY_SITE_ID;
      return hasKey
        ? { name: 'payment_provider', status: 'OK', message: 'CinetPay configured' }
        : { name: 'payment_provider', status: 'FAIL', message: 'PAYMENT_PROVIDER=CINETPAY but CINETPAY_API_KEY or CINETPAY_SITE_ID missing' };
    }
    return { name: 'payment_provider', status: 'WARN', message: `Unknown PAYMENT_PROVIDER: ${provider}` };
  }

  private checkStorageProvider(): ReadinessCheck {
    const provider = process.env.STORAGE_PROVIDER;
    if (provider === 'MOCK_STORAGE') {
      return { name: 'storage_provider', status: 'WARN', message: 'STORAGE_PROVIDER is MOCK_STORAGE — switch to S3 before launch' };
    }
    if (provider === 'S3') {
      const hasConfig =
        !!process.env.AWS_ACCESS_KEY_ID &&
        !!process.env.AWS_SECRET_ACCESS_KEY &&
        !!process.env.AWS_S3_BUCKET &&
        !!process.env.AWS_REGION;
      return hasConfig
        ? { name: 'storage_provider', status: 'OK', message: 'S3 configured' }
        : { name: 'storage_provider', status: 'FAIL', message: 'STORAGE_PROVIDER=S3 but one or more AWS_ env vars missing' };
    }
    return { name: 'storage_provider', status: 'WARN', message: `Unknown STORAGE_PROVIDER: ${provider}` };
  }

  private checkNotificationsFlag(): ReadinessCheck {
    const enabled = process.env.NOTIFICATIONS_ENABLED;
    if (enabled === 'true') {
      return { name: 'notifications', status: 'WARN', message: 'NOTIFICATIONS_ENABLED=true — verify email provider is wired before enabling in production' };
    }
    return { name: 'notifications', status: 'OK', message: 'NOTIFICATIONS_ENABLED=false (safe default)' };
  }
}
